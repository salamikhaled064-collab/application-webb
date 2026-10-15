import { Router } from "express";
import { z } from "zod";
import { ah } from "../lib/async-handler";
import { requireAuth } from "../middleware/auth";
import * as generationService from "../services/generation-service";
import { prisma } from "../lib/prisma";
import * as storage from "../services/storage-service";

const router = Router();

const createSchema = z
  .object({
    mode: z.enum(["PROMPT_ONLY", "IMAGE_TO_VIDEO"]).optional(),
    imageId: z.string().min(1).max(64).optional(),
    prompt: z.string().min(10).max(1500),
    format: z.enum(["9:16", "16:9", "1:1", "3:4"]),
    style: z.enum(["none", "cinematic", "realistic", "artistic", "dynamic", "anime"]),
    durationSeconds: z.number().int().min(1).max(3600),
    cameraMovement: z.string().max(200).optional(),
    mood: z.string().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    const mode = data.mode || (data.imageId ? "IMAGE_TO_VIDEO" : "PROMPT_ONLY");
    if (mode === "IMAGE_TO_VIDEO" && !data.imageId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "imageId requis pour IMAGE_TO_VIDEO",
        path: ["imageId"],
      });
    }
  });

router.post("/", requireAuth, async (req, res) => {
  try {
    const body = createSchema.parse(req.body);
    const mode = body.mode || (body.imageId ? "IMAGE_TO_VIDEO" : "PROMPT_ONLY");
    const result = await generationService.createGeneration({
      userId: req.user!.id,
      mode,
      imageId: body.imageId,
      prompt: body.prompt,
      format: body.format,
      style: body.style,
      durationSeconds: body.durationSeconds,
      isAdmin: req.user!.role === "admin",
      cameraMovement: body.cameraMovement,
      mood: body.mood,
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

const serveVideo = ah(async (req, res) => {
  const gen = await prisma.videoGeneration.findUnique({ where: { id: req.params.id } });
  if (!gen || gen.userId !== req.user!.id) {
    return res.status(404).json({ error: "Génération introuvable" });
  }
  if (gen.status !== "completed") {
    return res.status(400).json({ error: "Vidéo non disponible" });
  }

  const asDownload = req.path.endsWith("/download");
  const headers = {
    "Content-Type": "video/mp4",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `${asDownload ? "attachment" : "inline"}; filename="video-${gen.id}.mp4"`,
  };

  if (gen.videoStorageKey) {
    try {
      if (process.env.STORAGE_PROVIDER === "s3") {
        const buf = await storage.getObjectBuffer(gen.videoStorageKey);
        res.set(headers);
        res.setHeader("Content-Length", buf.length);
        return res.end(buf);
      }
      // sendFile gère les requêtes Range (lecture / avance rapide dans le lecteur vidéo)
      const abs = storage.getAbsolutePath(gen.videoStorageKey);
      if (storage.fileExists(gen.videoStorageKey)) {
        return res.sendFile(abs, { headers }, (err) => {
          if (err && !res.headersSent) res.status(404).json({ error: "Fichier vidéo introuvable" });
        });
      }
    } catch {
      /* on retombe sur les cas ci-dessous */
    }
  }

  // Fournisseur mock : vidéo de démonstration servie par redirection
  if (gen.provider === "mock" && gen.videoUrl) {
    return res.redirect(302, gen.videoUrl);
  }

  return res.status(404).json({
    error: "Fichier vidéo introuvable (il a peut-être expiré après un redémarrage du serveur).",
  });
});

router.get("/:id/video", requireAuth, serveVideo);
router.get("/:id/download", requireAuth, serveVideo);

export default router;
