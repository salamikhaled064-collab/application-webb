import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { config } from "../config";
import * as storage from "../services/storage-service";
import { detectImageMime, isAllowedImageMime } from "../lib/mime";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxImageSizeMb * 1024 * 1024, files: 1 },
});

router.post("/image", requireAuth, (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Erreur d'upload" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier fourni" });
    }

    try {
      const detected = detectImageMime(req.file.buffer);
      if (!detected || !isAllowedImageMime(detected)) {
        return res.status(400).json({
          error: "Format non supporté. Utilisez JPEG, PNG ou WebP.",
        });
      }

      const orig = (req.file.originalname || "").toLowerCase();
      if (orig.endsWith(".svg") || orig.endsWith(".html") || orig.endsWith(".js")) {
        return res.status(400).json({ error: "Type de fichier interdit" });
      }

      const { storageKey } = await storage.saveUploadAsync(
        req.file.buffer,
        req.file.originalname,
        detected
      );

      const record = await prisma.upload.create({
        data: {
          userId: req.user!.id,
          storageKey,
          originalName: req.file.originalname?.slice(0, 200) || "image",
          mimeType: detected,
          fileSize: req.file.size,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      res.status(201).json({
        imageId: record.id,
        originalName: record.originalName,
        mimeType: record.mimeType,
        fileSize: record.fileSize,
      });
    } catch (e: any) {
      console.error("[upload]", e?.message);
      res.status(500).json({ error: "Impossible d'enregistrer l'image" });
    }
  });
});

export default router;
