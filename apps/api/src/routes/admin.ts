import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { encrypt, maskKey } from "../lib/crypto";
import { config } from "../config";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/stats", async (_req, res) => {
  try {
    const [users, generations, completed, failed, keys] = await Promise.all([
      prisma.user.count(),
      prisma.videoGeneration.count(),
      prisma.videoGeneration.count({ where: { status: "completed" } }),
      prisma.videoGeneration.count({ where: { status: "failed" } }),
      prisma.apiKey.count({ where: { status: "active" } }),
    ]);
    res.json({ users, generations, completed, failed, activeKeys: keys });
  } catch {
    res.status(500).json({ error: "Erreur stats" });
  }
});

router.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      credits: true,
      plan: true,
      createdAt: true,
      lastSeenAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json({ users });
});

router.get("/api-keys", async (_req, res) => {
  const keys = await prisma.apiKey.findMany({
    select: {
      id: true,
      maskedKey: true,
      provider: true,
      status: true,
      usageCount: true,
      successCount: true,
      errorCount: true,
      rateLimitCount: true,
      lastUsedAt: true,
      disabledUntil: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ keys });
});

const addKeySchema = z.object({
  key: z.string().min(8).max(512),
  provider: z.string().default("agnes"),
});

router.post("/api-keys", async (req, res) => {
  try {
    const body = addKeySchema.parse(req.body);
    const encryptedKey = encrypt(body.key);
    const masked = maskKey(body.key);
    const row = await prisma.apiKey.create({
      data: {
        encryptedKey,
        maskedKey: masked,
        provider: body.provider,
        status: "active",
      },
    });
    await prisma.adminAuditLog.create({
      data: {
        adminId: req.user!.id,
        action: "api_key.create",
        targetType: "ApiKey",
        targetId: row.id,
      },
    });
    res.status(201).json({
      id: row.id,
      maskedKey: row.maskedKey,
      status: row.status,
    });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "Clé invalide" });
    }
    res.status(500).json({ error: "Impossible d'ajouter la clé" });
  }
});

router.patch("/api-keys/:id", async (req, res) => {
  const status = z.enum(["active", "disabled"]).parse(req.body.status);
  const row = await prisma.apiKey.update({
    where: { id: req.params.id },
    data: { status },
  });
  await prisma.adminAuditLog.create({
    data: {
      adminId: req.user!.id,
      action: `api_key.${status}`,
      targetType: "ApiKey",
      targetId: row.id,
    },
  });
  res.json({ id: row.id, status: row.status, maskedKey: row.maskedKey });
});

router.delete("/api-keys/:id", async (req, res) => {
  await prisma.apiKey.delete({ where: { id: req.params.id } });
  await prisma.adminAuditLog.create({
    data: {
      adminId: req.user!.id,
      action: "api_key.delete",
      targetType: "ApiKey",
      targetId: req.params.id,
    },
  });
  res.json({ ok: true });
});

router.get("/generations", async (_req, res) => {
  const gens = await prisma.videoGeneration.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      userId: true,
      status: true,
      progress: true,
      format: true,
      durationSeconds: true,
      creditsUsed: true,
      creditStatus: true,
      errorMessage: true,
      createdAt: true,
      completedAt: true,
    },
  });
  res.json({ generations: gens });
});

// silence unused config import warning in some TS setups
void config;

export default router;
