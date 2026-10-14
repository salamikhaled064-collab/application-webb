import { prisma } from "../lib/prisma";
import { config, VIDEO_PRESETS, VIDEO_DURATIONS } from "../config";
import * as creditService from "./credit-service";
import { enqueueGeneration } from "../queues/generation-queue";

const ALLOWED_FORMATS = new Set(Object.keys(VIDEO_PRESETS));
const ALLOWED_STYLES = new Set(["none", "cinematic", "realistic", "artistic", "dynamic", "anime"]);
const ALLOWED_DURATIONS = new Set([3, 5, 10, 18]);
const ALLOWED_MODES = new Set(["PROMPT_ONLY", "IMAGE_TO_VIDEO"]);

export interface CreateGenerationInput {
  userId: string;
  mode?: "PROMPT_ONLY" | "IMAGE_TO_VIDEO";
  imageId?: string;
  prompt: string;
  format: string;
  style: string;
  durationSeconds: number;
  cameraMovement?: string;
  mood?: string;
}

export async function createGeneration(input: CreateGenerationInput) {
  const mode = input.mode || (input.imageId ? "IMAGE_TO_VIDEO" : "PROMPT_ONLY");
  const { userId, prompt, format, style, durationSeconds } = input;

  if (!ALLOWED_MODES.has(mode)) {
    throw Object.assign(new Error("Mode non supporté"), { status: 400 });
  }
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

  let uploadId: string | null = null;
  if (mode === "IMAGE_TO_VIDEO") {
    if (!input.imageId) {
      throw Object.assign(new Error("Une image est obligatoire pour le mode image → vidéo"), {
        status: 400,
      });
    }
    const upload = await prisma.upload.findUnique({ where: { id: input.imageId } });
    if (!upload || upload.userId !== userId) {
      throw Object.assign(new Error("Image introuvable"), { status: 404 });
    }
    uploadId = input.imageId;
  }

  const preset = VIDEO_PRESETS[format];
  const duration = VIDEO_DURATIONS[durationSeconds];
  const cost = creditService.getCost(durationSeconds);

  const finalPrompt = buildFinalPrompt(prompt.trim(), style, input.cameraMovement, input.mood);

  const generation = await prisma.videoGeneration.create({
    data: {
      userId,
      uploadId,
      mode,
      prompt: prompt.trim(),
      finalPrompt,
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
      data: { status: "failed", errorMessage: "Crédits insuffisants", completedAt: new Date() },
    });
    throw err;
  }

  await prisma.videoGeneration.update({
    where: { id: generation.id },
    data: { status: "queued" },
  });

  await enqueueGeneration(generation.id);

  return {
    id: generation.id,
    status: "queued" as const,
    mode,
    creditsReserved: cost,
    message: "Génération ajoutée à la file",
  };
}

function buildFinalPrompt(
  prompt: string,
  style: string,
  camera?: string,
  mood?: string
): string {
  const parts = [prompt];
  if (style && style !== "none") {
    const styleLabels: Record<string, string> = {
      cinematic: "cinematic style, film look",
      realistic: "photorealistic",
      artistic: "artistic painting style",
      dynamic: "dynamic motion, energetic",
      anime: "anime style",
    };
    parts.push(`Style: ${styleLabels[style] || style}`);
  }
  if (camera) parts.push(`Camera: ${camera}`);
  if (mood) parts.push(`Mood: ${mood}`);
  return parts.join(". ");
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
  const hasVideo = gen.status === "completed" && (gen.videoStorageKey || gen.videoUrl);
  return {
    id: gen.id,
    mode: gen.mode || "IMAGE_TO_VIDEO",
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
