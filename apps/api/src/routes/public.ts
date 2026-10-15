import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ah } from "../lib/async-handler";
import { verifySignedUpload } from "../lib/signed-url";
import * as storage from "../services/storage-service";

const router = Router();

// Image de départ lue par le fournisseur (Agnes) via une URL signée et temporaire
router.get(
  "/uploads/:id",
  ah(async (req, res) => {
    if (!verifySignedUpload(req.params.id, req.query.exp, req.query.sig)) {
      return res.status(403).json({ error: "Lien invalide ou expiré" });
    }
    const upload = await prisma.upload.findUnique({ where: { id: req.params.id } });
    if (!upload) return res.status(404).json({ error: "Image introuvable" });

    const headers = {
      "Content-Type": upload.mimeType,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    };
    if (process.env.STORAGE_PROVIDER === "s3") {
      const buf = await storage.getObjectBuffer(upload.storageKey);
      res.set(headers);
      return res.end(buf);
    }
    if (!storage.fileExists(upload.storageKey)) {
      return res.status(404).json({ error: "Fichier introuvable" });
    }
    return res.sendFile(storage.getAbsolutePath(upload.storageKey), { headers });
  })
);

export default router;
