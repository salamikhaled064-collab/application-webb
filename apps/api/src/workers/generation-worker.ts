/**
 * Generation worker – separate process.
 * Uses MockVideoProvider / AgnesVideoProvider from packages/video-provider.
 * Temporary errors are rethrown for BullMQ retry; permanent errors mark failed + refund once.
 */
import { config, safeLog } from "../config";
import { prisma } from "../lib/prisma";
import * as creditService from "../services/credit-service";
import { buildSignedUploadUrl } from "../lib/signed-url";
import * as storage from "../services/storage-service";
import {
  setJobHandler,
  enqueueGeneration,
  initQueue,
  closeQueue,
  getBullConnection,
  getQueueName,
} from "../queues/generation-queue";
import {
  MockVideoProvider,
  AgnesVideoProvider,
  BytePlusVideoProvider,
  type VideoProvider,
  type VideoGenerationResult,
} from "@ai-video/video-provider";

export type ProviderName = "mock" | "agnes" | "byteplus";

const LABEL: Record<ProviderName, string> = { mock: "démo", agnes: "Agnes", byteplus: "BytePlus" };
const ENV_KEY: Record<ProviderName, string> = { mock: "", agnes: "AGNES_API_KEY", byteplus: "BYTEPLUS_API_KEY" };

/** Ordre des fournisseurs à essayer. En mode "auto" : BytePlus d'abord, puis Agnes. */
function buildChain(): ProviderName[] {
  const v = config.videoProvider;
  if (v === "mock") return ["mock"];
  if (v === "auto") return ["byteplus", "agnes"];
  const fb = config.videoProviderFallback;
  return fb && fb !== v ? [v, fb] : [v];
}

interface Candidate {
  provider: ProviderName;
  keyId: string | null;
  key: string;
  label: string;
}

/**
 * Toutes les clés utilisables, dans l'ordre : fournisseur 1 (clés les moins récemment utilisées d'abord),
 * puis fournisseur 2… Les clés « en pause » dont la pause est écoulée redeviennent utilisables.
 */
async function listCandidates(chain: ProviderName[]): Promise<Candidate[]> {
  const { decrypt } = await import("../lib/crypto");
  const out: Candidate[] = [];
  for (const provider of chain) {
    if (provider === "mock") {
      out.push({ provider, keyId: null, key: "mock", label: "démo" });
      continue;
    }
    const rows = await prisma.apiKey.findMany({
      where: {
        provider,
        status: { in: ["active", "cooldown"] },
        OR: [{ disabledUntil: null }, { disabledUntil: { lt: new Date() } }],
      },
      orderBy: { lastUsedAt: "asc" },
    });
    for (const row of rows) {
      try {
        out.push({ provider, keyId: row.id, key: decrypt(row.encryptedKey), label: `${LABEL[provider]} ${row.maskedKey}` });
      } catch {
        // Clé illisible (ENCRYPTION_KEY changée ?) : on la signale et on passe à la suivante
        await prisma.apiKey
          .update({ where: { id: row.id }, data: { status: "disabled", lastError: "Clé illisible : ENCRYPTION_KEY a probablement changé. Ressaisissez la clé." } })
          .catch(() => {});
      }
    }
    const envKey = process.env[ENV_KEY[provider]];
    if (envKey) out.push({ provider, keyId: null, key: envKey, label: `${LABEL[provider]} (clé du serveur)` });
  }
  return out;
}

/** Image de départ en base64 (BytePlus l'accepte directement : pas besoin d'URL publique). */
async function uploadAsDataUrl(upload: { storageKey: string; mimeType: string }): Promise<string> {
  let buf: Buffer;
  if (process.env.STORAGE_PROVIDER === "s3") {
    buf = await storage.getObjectBuffer(upload.storageKey);
  } else {
    const fs = await import("fs/promises");
    buf = await fs.readFile(storage.getAbsolutePath(upload.storageKey));
  }
  return `data:${upload.mimeType};base64,${buf.toString("base64")}`;
}

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

function getProvider(name: ProviderName): VideoProvider {
  if (name === "byteplus") {
    return new BytePlusVideoProvider({
      model: config.byteplus.model,
      baseUrl: config.byteplus.baseUrl,
      resolution: config.byteplus.resolution,
      generateAudio: config.byteplus.generateAudio,
      watermark: config.byteplus.watermark,
      requestTimeoutMs: config.byteplus.requestTimeoutMs,
      resultTimeoutMs: config.byteplus.resultTimeoutMs,
    });
  }
  if (name === "agnes") {
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
    data: { status: "processing", startedAt: new Date(), progress: 5, errorMessage: null },
  });

  try {
    const isPromptOnly = (gen as any).mode === "PROMPT_ONLY" || !gen.upload;
    if (!isPromptOnly && !gen.upload) {
      throw new Error("Image manquante"); // permanent
    }

    // ---- Choix du fournisseur ET de la clé, avec bascule automatique ----
    // Chaque clé est essayée à tour de rôle ; si elle échoue (refusée, quota épuisé, limite, saturation),
    // on passe IMMÉDIATEMENT à la suivante, puis au fournisseur suivant.
    const chain = buildChain();
    let candidates = await listCandidates(chain);
    if (candidates.length === 0 && config.videoProvider === "auto") {
      candidates = [{ provider: "mock", keyId: null, key: "mock", label: "démo" }]; // aucune clé : mode démonstration
    }
    if (candidates.length === 0) {
      const paused = await prisma.apiKey.count({
        where: { provider: { in: chain }, status: "cooldown", disabledUntil: { gt: new Date() } },
      });
      if (paused > 0) {
        throw new TemporaryError("Toutes les clés sont en pause (limite de requêtes atteinte). Nouvel essai bientôt.");
      }
      throw new Error(
        `Aucune clé API utilisable pour ${chain.map((c) => LABEL[c]).join(" / ")}. Ajoutez une clé dans /admin → Clés API (ou réactivez-en une).`
      );
    }

    let providerName: ProviderName = "mock";
    let provider: VideoProvider = new MockVideoProvider();
    let apiKey = "mock";
    let apiKeyId: string | null = null;
    let created: VideoGenerationResult | undefined;

    const skipped: string[] = [];
    const skipProviders = new Set<ProviderName>();
    let lastTemporary = "";
    let firstFatal = "";
    let dataUrlCache: string | undefined;

    for (const cand of candidates) {
      if (skipProviders.has(cand.provider)) continue;
      const p = getProvider(cand.provider);

      // Agnes télécharge l'image depuis une URL PUBLIQUE signée ; BytePlus reçoit l'image en base64.
      let imageUrl: string | undefined;
      let imageDataUrl: string | undefined;
      if (gen.upload && cand.provider === "byteplus") {
        imageDataUrl = dataUrlCache ??= await uploadAsDataUrl(gen.upload);
      }
      if (gen.upload && cand.provider === "agnes") {
        const signed = buildSignedUploadUrl(gen.upload.id);
        if (!signed) {
          skipped.push("Agnes : PUBLIC_BASE_URL manquante (l'image ne peut pas être lue)");
          skipProviders.add("agnes");
          continue;
        }
        imageUrl = signed;
      }

      if (cand.keyId) {
        await prisma.apiKey.update({
          where: { id: cand.keyId },
          data: { lastUsedAt: new Date(), usageCount: { increment: 1 } },
        });
      }

      let res: VideoGenerationResult;
      try {
        res = await p.createVideo(
          {
            model: cand.provider === "byteplus" ? config.byteplus.model : config.agnes.model,
            prompt: gen.finalPrompt || gen.prompt,
            imageUrl,
            imageDataUrl,
            aspectRatio: gen.format,
            seconds: gen.durationSeconds,
            width: gen.width,
            height: gen.height,
            numFrames: gen.numFrames,
            frameRate: gen.frameRate,
          },
          cand.key
        );
      } catch (e: any) {
        res = {
          providerJobId: "",
          status: "failed",
          errorKind: "temporary",
          errorMessage: `Erreur réseau (${cand.label}) : ${e?.message || "inconnue"}`,
        };
      }

      if (res.status !== "failed" && res.providerJobId) {
        created = res;
        provider = p;
        providerName = cand.provider;
        apiKey = cand.key;
        apiKeyId = cand.keyId;
        if (cand.keyId) {
          // La clé a fonctionné : on efface une éventuelle pause / erreur précédente
          await prisma.apiKey
            .update({ where: { id: cand.keyId }, data: { status: "active", disabledUntil: null, lastError: null } })
            .catch(() => {});
        }
        break;
      }

      const kind = res.errorKind ?? "fatal";
      const msg = res.errorMessage || "Création refusée par le fournisseur vidéo";
      safeLog("worker", `échec avec ${cand.label} (${kind}) – clé suivante`, { generationId, error: msg });

      if (kind === "auth" || kind === "quota") {
        // Clé inutilisable : désactivée automatiquement (réactivable depuis /admin)
        if (cand.keyId) {
          await prisma.apiKey
            .update({
              where: { id: cand.keyId },
              data: { status: "disabled", errorCount: { increment: 1 }, lastError: msg.slice(0, 300) },
            })
            .catch(() => {});
        }
        skipped.push(`${cand.label} : ${msg}`);
        continue;
      }
      if (kind === "rate_limit") {
        if (cand.keyId) {
          await prisma.apiKey
            .update({
              where: { id: cand.keyId },
              data: {
                status: "cooldown",
                disabledUntil: new Date(Date.now() + 60 * 1000), // pause courte : 1 minute
                errorCount: { increment: 1 },
                rateLimitCount: { increment: 1 },
                lastError: msg.slice(0, 300),
              },
            })
            .catch(() => {});
        }
        lastTemporary = msg;
        continue;
      }
      if (kind === "temporary") {
        lastTemporary = msg;
        continue;
      }
      // fatal : demande refusée (contenu, paramètres). Changer de clé ne sert à rien chez ce fournisseur.
      firstFatal ||= msg;
      skipProviders.add(cand.provider);
    }

    if (!created) {
      if (lastTemporary) throw new TemporaryError(lastTemporary); // on réessaiera (toute la chaîne)
      if (firstFatal) throw new Error(firstFatal);
      throw new Error(`Aucune clé utilisable. ${skipped.join(" | ")}`);
    }

    const providerJobId = created.providerJobId;
    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        provider: providerName,
        providerJobId,
        progress: 15,
        // Toujours écrit (null inclus) : sinon l'identifiant d'une clé utilisée lors d'un essai précédent
        // resterait et le suivi interrogerait le fournisseur avec la mauvaise clé.
        apiKeyId,
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
        if (providerName !== "mock" && current.apiKeyId) {
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
        if (providerName !== "mock") {
          try {
            const dl = await storage.downloadVideoToStorage(
              status.videoUrl,
              config.maxVideoSizeMb * 1024 * 1024
            );
            videoStorageKey = dl.storageKey;
          } catch (dlErr: any) {
            // Non bloquant : le lien du fournisseur reste valable ~24 h, la vidéo est servie par redirection.
            safeLog("worker", "téléchargement vidéo impossible, lien fournisseur conservé", {
              generationId,
              error: dlErr?.message,
            });
          }
        }

        if (current.apiKeyId) {
          await prisma.apiKey
            .update({ where: { id: current.apiKeyId }, data: { successCount: { increment: 1 } } })
            .catch(() => {});
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
      // Sans BullMQ il n'y a pas de retry automatique : on le fait ici quand le fournisseur est
      // momentanément saturé (503), limité (429) ou injoignable. Si un fournisseur de SECOURS est
      // configuré, on bascule dessus après quelques échecs.
      const max = Math.max(1, config.queue.memoryRetries);
      let tries = 0;
      for (;;) {
        tries++;
        try {
          await processGeneration(data);
          return;
        } catch (err: any) {
          const temporary = err instanceof TemporaryError || err?.name === "TemporaryError";
          if (!temporary) {
            await failAndRefund(data.generationId, err?.message || "Erreur");
            return;
          }

          if (tries >= max) {
            await failAndRefund(data.generationId, err?.message || "Erreur");
            return;
          }

          const wait = config.queue.memoryRetryDelayMs;
          safeLog("worker", `fournisseur occupé – nouvel essai ${tries + 1}/${max} dans ${Math.round(wait / 1000)}s`, {
            generationId: data.generationId,
            error: err?.message,
          });
          // Message visible sur la page de la vidéo (au lieu d'un "5 %" muet)
          await prisma.videoGeneration
            .update({
              where: { id: data.generationId },
              data: {
                errorMessage: `Le fournisseur vidéo est occupé. Nouvel essai ${tries + 1}/${max} dans ${Math.round(wait / 1000)} s…`,
              },
            })
            .catch(() => {});
          await sleep(wait);
        }
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
