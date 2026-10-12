import { prisma } from "../lib/prisma";
import { config, VIDEO_PRESETS, VIDEO_DURATIONS } from "../config";
import * as creditService from "./credit-service";
import { enqueueGeneration } from "../queues/generation-queue";

const ALLOWED_FORMATS = new Set(Object.keys(VIDEO_PRESETS));
const ALLOWED_STYLES = new Set(["none", "cinematic", "realistic", "artistic", "dynamic", "anime"]);
const ALLOWED_DURATIONS = new Set([3, 5, 10, 18]);

export interface CreateGenerationInput {
  userId: string;
  imageId: string;
  prompt: string;
  format: string;
  style: string;
  durationSeconds: number;
}

export async function createGeneration(input: CreateGenerationInput) {
  const { userId, imageId, prompt, format, style, durationSeconds } = input;

  if (!prompt || prompt.trim().length < 10) {
    throw Object.assign(new Error("Le prompt doit contenir au moins 10 caractères"), { status: 400 });
  }
  if (prompt.length > 1500) {
    throw Object.assign(new Error("Le prompt dépasse la taille maximale"), { status: 400 });
  }
  if (!ALLOWED_FORMATS.has(format)) {
    throw Object.assign(new Error("Format non supporté"), { status: 400 });
  }
  if (!ALLOWED_STYLES.has(style)) {
    throw Object.assign(new Error("Style non supporté"), { status: 400 });
  }
  if (!ALLOWED_DURATIONS.has(durationSeconds)) {
    throw Object.assign(new Error("Durée non supportée"), { status: 400 });
  }

  const upload = await prisma.upload.findUnique({ where: { id: imageId } });
  if (!upload || upload.userId !== userId) {
    throw Object.assign(new Error("Image introuvable"), { status: 404 });
  }

  const preset = VIDEO_PRESETS[format];
  const duration = VIDEO_DURATIONS[durationSeconds];
  const cost = creditService.getCost(durationSeconds);

  // Create generation first (pending), then reserve credits
  const generation = await prisma.videoGeneration.create({
    data: {
      userId,
      uploadId: imageId,
      prompt: prompt.trim(),
      finalPrompt: buildFinalPrompt(prompt.trim(), style),
      style,
      format,
      durationSeconds,
      width: preset.width,
      height: preset.height,
      numFrames: duration.numFrames,
      frameRate: config.agnes.frameRate,
      provider: config.videoProvider,
      status: "pending",
      progress: 0,
      creditsUsed: cost,
    },
  });

  try {
    await creditService.reserveCredits(userId, cost, generation.id);
  } catch (err) {
    await prisma.videoGeneration.update({
      where: { id: generation.id },
      data: { status: "failed", errorMessage: "Crédits insuffisants" },
    });
    throw err;
  }

  await prisma.videoGeneration.update({
    where: { id: generation.id },
    data: { status: "queued" },
  });

  // Enqueue for processing
  await enqueueGeneration(generation.id);

  return {
    generationId: generation.id,
    status: "queued" as const,
    creditsReserved: cost,
  };
}

function buildFinalPrompt(prompt: string, style: string): string {
  if (!style || style === "none") return prompt;
  const styleLabels: Record<string, string> = {
    cinematic: "cinematic style, film look",
    realistic: "photorealistic",
    artistic: "artistic painting style",
    dynamic: "dynamic motion, energetic",
    anime: "anime style",
  };
  return `${prompt}. Style: ${styleLabels[style] || style}`;
}

export async function getGeneration(id: string, userId: string) {
  const gen = await prisma.videoGeneration.findUnique({ where: { id } });
  if (!gen || gen.userId !== userId) {
    throw Object.assign(new Error("Génération introuvable"), { status: 404 });
  }
  return sanitizeGeneration(gen);
}

export async function listGenerations(userId: string, limit = 50) {
  const gens = await prisma.videoGeneration.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return gens.map(sanitizeGeneration);
}

export async function cancelGeneration(id: string, userId: string) {
  const gen = await prisma.videoGeneration.findUnique({ where: { id } });
  if (!gen || gen.userId !== userId) {
    throw Object.assign(new Error("Génération introuvable"), { status: 404 });
  }
  if (!["pending", "queued", "processing"].includes(gen.status)) {
    throw Object.assign(new Error("Cette génération ne peut plus être annulée"), { status: 400 });
  }

  await prisma.videoGeneration.update({
    where: { id },
    data: { status: "cancelled", completedAt: new Date() },
  });

  if (gen.creditsUsed > 0) {
    await creditService.refundCredits(userId, gen.creditsUsed, id);
  }

  return { ok: true };
}

function sanitizeGeneration(gen: any) {
  // Never expose raw Agnes URL – frontend must use /api/generations/:id/video
  const hasVideo = gen.status === "completed" && (gen.videoStorageKey || gen.videoUrl);
  return {
    id: gen.id,
    prompt: gen.prompt,
    style: gen.style,
    format: gen.format,
    durationSeconds: gen.durationSeconds,
    status: gen.status,
    progress: gen.progress,
    hasVideo: Boolean(hasVideo),
    videoUrl: hasVideo ? `/api/generations/${gen.id}/video` : null,
    downloadUrl: hasVideo ? `/api/generations/${gen.id}/download` : null,
    thumbnailUrl: gen.thumbnailUrl,
    errorMessage: gen.errorMessage,
    creditsUsed: gen.creditsUsed,
    creditStatus: gen.creditStatus,
    createdAt: gen.createdAt,
    completedAt: gen.completedAt,
  };
}
