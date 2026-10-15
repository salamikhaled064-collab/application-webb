/**
 * Generation worker – separate process.
 * Uses MockVideoProvider / AgnesVideoProvider from packages/video-provider.
 * Temporary errors are rethrown for BullMQ retry; permanent errors mark failed + refund once.
 */
import { config, safeLog } from "../config";
import { prisma } from "../lib/prisma";
import * as creditService from "../services/credit-service";
import * as storage from "../services/storage-service";
import {
  setJobHandler,
  enqueueGeneration,
  initQueue,
  closeQueue,
  getBullConnection,
  getQueueName,
} from "../queues/generation-queue";
import { MockVideoProvider, AgnesVideoProvider, type VideoProvider } from "@ai-video/video-provider";

/** Mark errors that BullMQ should retry */
export class TemporaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemporaryError";
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function getProvider(): VideoProvider {
  if (config.videoProvider === "agnes") {
    return new AgnesVideoProvider({
      model: config.agnes.model,
      baseUrl: config.agnes.baseUrl,
      createPath: config.agnes.createPath,
      resultPath: config.agnes.resultPath,
      requestTimeoutMs: config.agnes.requestTimeoutMs,
      resultTimeoutMs: config.agnes.resultTimeoutMs,
      imageMode: "base64",
    });
  }
  return new MockVideoProvider();
}

export async function processGeneration(data: { generationId: string }) {
  const generationId = data.generationId;
  const gen = await prisma.videoGeneration.findUnique({
    where: { id: generationId },
    include: { upload: true },
  });
  if (!gen || gen.status === "cancelled") return;

  if (["completed", "failed", "cancelled"].includes(gen.status)) return;

  await prisma.videoGeneration.update({
    where: { id: generationId },
    data: { status: "processing", startedAt: new Date(), progress: 5 },
  });

  try {
    const isPromptOnly = (gen as any).mode === "PROMPT_ONLY" || !gen.upload;
    if (!isPromptOnly && !gen.upload) {
      throw new Error("Image manquante"); // permanent
    }

    const provider = getProvider();
    let apiKey = "mock";
    let apiKeyId: string | null = null;

    if (config.videoProvider === "agnes") {
      // Prefer encrypted keys from /admin; fallback to AGNES_API_KEY env
      const keyRow = await prisma.apiKey.findFirst({
        where: {
          status: "active",
          OR: [{ disabledUntil: null }, { disabledUntil: { lt: new Date() } }],
        },
        orderBy: { lastUsedAt: "asc" },
      });
      if (keyRow) {
        const { decrypt } = await import("../lib/crypto");
        apiKey = decrypt(keyRow.encryptedKey);
        apiKeyId = keyRow.id;
        await prisma.apiKey.update({
          where: { id: keyRow.id },
          data: { lastUsedAt: new Date(), usageCount: { increment: 1 } },
        });
      } else if (process.env.AGNES_API_KEY) {
        apiKey = process.env.AGNES_API_KEY;
      } else {
        throw new Error(
          "Le fournisseur Agnes est activé mais aucune clé API valide n'est configurée côté serveur. Ajoutez une clé via /admin ou la variable AGNES_API_KEY."
        );
      }
    }

    let imageDataUrl = "";
    if (gen.upload) {
      try {
        imageDataUrl = await storage.readFileAsBase64DataUrlAsync(
          gen.upload.storageKey,
          gen.upload.mimeType
        );
      } catch {
        imageDataUrl = storage.readFileAsBase64DataUrl(
          gen.upload.storageKey,
          gen.upload.mimeType
        );
      }
    }

    let created;
    try {
      created = await provider.createVideo(
        {
          model: config.agnes.model,
          prompt: gen.finalPrompt || gen.prompt,
          image: imageDataUrl || undefined,
          width: gen.width,
          height: gen.height,
          numFrames: gen.numFrames,
          frameRate: gen.frameRate,
        },
        apiKey
      );
    } catch (err: any) {
      const msg = err.message || "";
      if (/429|rate limit|timeout|ECONNRESET|5\d\d|network|abort/i.test(msg)) {
        if (apiKeyId && /429/.test(msg)) {
          await prisma.apiKey.update({
            where: { id: apiKeyId },
            data: {
              errorCount: { increment: 1 },
              rateLimitCount: { increment: 1 },
              disabledUntil: new Date(Date.now() + 15 * 60 * 1000),
              status: "cooldown",
            },
          });
        }
        throw new TemporaryError(msg);
      }
      throw err; // permanent
    }

    const providerJobId = created.providerJobId;
    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        providerJobId,
        progress: 15,
        ...(apiKeyId ? { apiKeyId } : {}),
      },
    });

    // Poll
    for (let i = 0; i < config.agnes.pollMaxAttempts; i++) {
      await sleep(config.agnes.pollIntervalMs);

      const current = await prisma.videoGeneration.findUnique({ where: { id: generationId } });
      if (!current || current.status === "cancelled") return;

      let status;
      try {
        // For Agnes, reuse same key
        let pollKey = apiKey;
        if (config.videoProvider === "agnes" && current.apiKeyId) {
          const keyRow = await prisma.apiKey.findUnique({ where: { id: current.apiKeyId } });
          if (keyRow) {
            const { decrypt } = await import("../lib/crypto");
            pollKey = decrypt(keyRow.encryptedKey);
          }
        }
        status = await provider.getVideoStatus(providerJobId, pollKey);
      } catch (err: any) {
        const msg = err.message || "";
        if (/429|timeout|5\d\d|network|abort/i.test(msg)) {
          throw new TemporaryError(msg);
        }
        throw err;
      }

      if (status.status === "completed" && status.videoUrl) {
        let videoStorageKey: string | null = null;
        // Mock : vidéo de démonstration servie par redirection, on ne la télécharge pas.
        if (config.videoProvider !== "mock") {
          try {
            const dl = await storage.downloadVideoToStorage(
              status.videoUrl,
              config.maxVideoSizeMb * 1024 * 1024
            );
            videoStorageKey = dl.storageKey;
          } catch (dlErr: any) {
            throw new Error(`Téléchargement vidéo impossible: ${dlErr.message}`);
          }
        }

        await prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            status: "completed",
            progress: 100,
            videoUrl: status.videoUrl,
            videoStorageKey,
            completedAt: new Date(),
          },
        });
        await creditService.chargeCredits(gen.userId, gen.creditsUsed, generationId);
        safeLog("worker", "completed", { generationId, stored: Boolean(videoStorageKey) });
        return;
      }

      if (status.status === "failed") {
        throw new Error(status.errorMessage || "Génération échouée");
      }

      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          progress: status.progress ?? Math.min(90, 15 + i),
          status: "processing",
        },
      });
    }

    throw new TemporaryError("Délai maximal dépassé – retry");
  } catch (err: any) {
    if (err instanceof TemporaryError || err.name === "TemporaryError") {
      // Re-throw so BullMQ retries; do NOT mark failed or refund yet
      safeLog("worker", "temporary error – will retry", { generationId, error: err.message });
      throw err;
    }

    safeLog("worker", "permanent failure", { generationId, error: err.message });
    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        status: "failed",
        errorMessage: err.message || "Erreur",
        completedAt: new Date(),
      },
    });
    try {
      await creditService.refundCredits(gen.userId, gen.creditsUsed, generationId);
    } catch {
      /* ignore */
    }
  }
}

const FINAL_STATES = ["completed", "failed", "cancelled"];

/** Après épuisement des tentatives BullMQ : statut failed + remboursement (une seule fois). */
async function failAndRefund(generationId: string, message: string) {
  try {
    const g = await prisma.videoGeneration.findUnique({ where: { id: generationId } });
    if (g && !FINAL_STATES.includes(g.status)) {
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: { status: "failed", errorMessage: message || "Échec après retries", completedAt: new Date() },
      });
      await creditService.refundCredits(g.userId, g.creditsUsed, generationId);
    }
  } catch (e: any) {
    safeLog("worker", "failAndRefund error", { error: e?.message });
  }
}

async function startBullWorker() {
  const connection = getBullConnection();
  const { Worker } = await import("bullmq");
  const worker = new Worker(
    getQueueName(),
    async (job) => {
      await processGeneration(job.data);
    },
    { connection, concurrency: config.queue.concurrency }
  );
  worker.on("failed", (job, err) => {
    safeLog("worker", "job attempt failed", { id: job?.id, error: err.message });
    const attempts = job?.opts?.attempts ?? 1;
    if (job?.data?.generationId && job.attemptsMade >= attempts) {
      void failAndRefund(job.data.generationId, err.message);
    }
  });
  worker.on("error", (err) => safeLog("worker", "worker error", { error: err.message }));
  safeLog("worker", `BullMQ worker started concurrency=${config.queue.concurrency}`);
  return worker;
}

/**
 * Au démarrage : relance les générations restées bloquées (serveur redémarré,
 * file mémoire perdue…) pour qu'elles ne restent jamais "en cours" indéfiniment.
 */
export async function recoverStuckGenerations() {
  try {
    const stuck = await prisma.videoGeneration.findMany({
      where: { status: { in: ["pending", "queued", "processing"] } },
      select: { id: true },
      take: 200,
    });
    for (const g of stuck) {
      await prisma.videoGeneration.update({
        where: { id: g.id },
        data: { status: "queued", progress: 0 },
      });
      await enqueueGeneration(g.id).catch(() => {});
    }
    if (stuck.length) safeLog("worker", `Recovered ${stuck.length} stuck generation(s)`);
  } catch (e: any) {
    safeLog("worker", "recover error", { error: e?.message });
  }
}

/** Worker dans le même processus que l'API (RUN_WORKER_IN_API=true). */
export async function startWorkerInProcess() {
  if (getBullConnection()) {
    await startBullWorker();
  } else {
    setJobHandler(async (data) => {
      try {
        await processGeneration(data);
      } catch (err: any) {
        // File mémoire : pas de retry BullMQ → on échoue proprement et on rembourse.
        await failAndRefund(data.generationId, err?.message || "Erreur");
      }
    });
    safeLog("worker", `In-process memory handler ready (provider=${config.videoProvider})`);
  }
  await recoverStuckGenerations();
}

async function main() {
  await initQueue();

  if (!getBullConnection() || !config.redisUrl) {
    safeLog("worker", "No Redis – standalone worker needs REDIS_URL, using in-process handler");
    await startWorkerInProcess();
  } else {
    await startBullWorker();
  }

  const shutdown = async (sig: string) => {
    safeLog("worker", `${sig} shutting down`);
    await closeQueue();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[worker] Fatal:", err.message);
    process.exit(1);
  });
}
