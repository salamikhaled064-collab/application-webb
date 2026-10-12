import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import * as generationService from "../services/generation-service";
import { prisma } from "../lib/prisma";
import * as storage from "../services/storage-service";

const router = Router();

const createSchema = z.object({
  imageId: z.string().min(1).max(64),
  prompt: z.string().min(10).max(1500),
  format: z.enum(["9:16", "16:9", "1:1", "4:5"]),
  style: z.enum(["none", "cinematic", "realistic", "artistic", "dynamic", "anime"]),
  durationSeconds: z.union([z.literal(3), z.literal(5), z.literal(10), z.literal(18)]),
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const body = createSchema.parse(req.body);
    const result = await generationService.createGeneration({
      userId: req.user!.id,
      imageId: body.imageId,
      prompt: body.prompt,
      format: body.format,
      style: body.style,
      durationSeconds: body.durationSeconds,
    });
    res.status(201).json(result);
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: err.errors[0]?.message || "Données invalides" });
    }
    res.status(err.status || 500).json({ error: err.message || "Erreur serveur" });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const list = await generationService.listGenerations(req.user!.id);
    res.json({ generations: list });
  } catch {
    res.status(500).json({ error: "Impossible de récupérer l'historique" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const gen = await generationService.getGeneration(req.params.id, req.user!.id);
    res.json(gen);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || "Erreur" });
  }
});

router.post("/:id/cancel", requireAuth, async (req, res) => {
  try {
    await generationService.cancelGeneration(req.params.id, req.user!.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || "Erreur" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const gen = await prisma.videoGeneration.findUnique({ where: { id: req.params.id } });
    if (!gen || gen.userId !== req.user!.id) {
      return res.status(404).json({ error: "Génération introuvable" });
    }
    if (gen.videoStorageKey) storage.deleteFile(gen.videoStorageKey);
    await prisma.videoGeneration.delete({ where: { id: gen.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Suppression impossible" });
  }
});

async function serveVideo(req: any, res: any, asDownload: boolean) {
  const gen = await prisma.videoGeneration.findUnique({ where: { id: req.params.id } });
  if (!gen || gen.userId !== req.user!.id) {
    return res.status(404).json({ error: "Génération introuvable" });
  }
  if (gen.status !== "completed") {
    return res.status(400).json({ error: "Vidéo non disponible" });
  }

  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Content-Disposition",
    `${asDownload ? "attachment" : "inline"}; filename="video-${gen.id}.mp4"`
  );

  if (gen.videoStorageKey) {
    try {
      if (process.env.STORAGE_PROVIDER === "s3") {
        const buf = await storage.getObjectBuffer(gen.videoStorageKey);
        res.setHeader("Content-Length", buf.length);
        return res.end(buf);
      }
      const stream = storage.createReadStream(gen.videoStorageKey);
      if (stream) return stream.pipe(res);
    } catch {
      return res.status(404).json({ error: "Fichier vidéo introuvable" });
    }
  }

  // Mock only: external demo URL
  if (process.env.VIDEO_PROVIDER === "mock" && gen.videoUrl && !/agnes/i.test(gen.videoUrl)) {
    return res.redirect(302, gen.videoUrl);
  }

  return res.status(404).json({ error: "Fichier vidéo introuvable" });
}

router.get("/:id/video", requireAuth, (req, res) => serveVideo(req, res, false));
router.get("/:id/download", requireAuth, (req, res) => serveVideo(req, res, true));

export default router;
