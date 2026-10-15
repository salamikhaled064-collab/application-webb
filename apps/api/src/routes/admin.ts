import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { encrypt, maskKey } from "../lib/crypto";
import { ah, HttpError } from "../lib/async-handler";
import argon2 from "argon2";
import { config } from "../config";

const router = Router();

router.use(requireAuth, requireAdmin);

async function audit(adminId: string, action: string, targetType: string, targetId: string, metadata?: unknown) {
  await prisma.adminAuditLog
    .create({
      data: { adminId, action, targetType, targetId, metadata: metadata ? JSON.stringify(metadata) : null },
    })
    .catch(() => {});
}

router.get(
  "/stats",
  ah(async (_req, res) => {
    const [users, generations, completed, failed, processing, keys] = await Promise.all([
      prisma.user.count(),
      prisma.videoGeneration.count(),
      prisma.videoGeneration.count({ where: { status: "completed" } }),
      prisma.videoGeneration.count({ where: { status: "failed" } }),
      prisma.videoGeneration.count({ where: { status: { in: ["pending", "queued", "processing"] } } }),
      prisma.apiKey.count({ where: { status: "active" } }),
    ]);
    res.json({
      users,
      generations,
      completed,
      failed,
      processing,
      activeKeys: keys,
      // État du fournisseur vidéo : l'admin voit tout de suite si c'est le mode démo
      provider: config.videoProvider,
      model: config.videoProvider === "agnes" ? config.agnes.model : "démo",
      publicUrlConfigured: Boolean(config.publicBaseUrl),
    });
  })
);

router.get(
  "/users",
  ah(async (_req, res) => {
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
      take: 200,
    });
    res.json({ users });
  })
);

const roleSchema = z.object({ role: z.enum(["admin", "user"]) });

// Promouvoir un utilisateur en admin, ou lui retirer ce rôle
router.patch(
  "/users/:id/role",
  ah(async (req, res) => {
    const { role } = roleSchema.parse(req.body);
    if (req.params.id === req.user!.id) {
      throw new HttpError(400, "Vous ne pouvez pas modifier votre propre rôle.");
    }
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new HttpError(404, "Utilisateur introuvable");
    if (target.role === "admin" && role === "user") {
      const admins = await prisma.user.count({ where: { role: "admin" } });
      if (admins <= 1) throw new HttpError(400, "Impossible : il doit rester au moins un administrateur.");
    }
    const updated = await prisma.user.update({ where: { id: target.id }, data: { role } });
    await audit(req.user!.id, `user.role.${role}`, "User", updated.id);
    res.json({ id: updated.id, role: updated.role });
  })
);

const newAdminSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail invalide"),
  name: z.string().trim().max(80).optional(),
  password: z.string().min(10, "Mot de passe : 10 caractères minimum").max(200),
});

// Créer directement un compte administrateur
router.post(
  "/admins",
  ah(async (req, res) => {
    const body = newAdminSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: body.email } });
    if (exists) {
      throw new HttpError(409, "Ce compte existe déjà : utilisez « Promouvoir » dans la liste des utilisateurs.");
    }
    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name || null,
        passwordHash: await argon2.hash(body.password, { type: argon2.argon2id }),
        role: "admin",
        credits: config.defaultUserCredits,
      },
    });
    await audit(req.user!.id, "admin.create", "User", user.id);
    res.status(201).json({ id: user.id, email: user.email, role: user.role });
  })
);

const creditsSchema = z.object({
  amount: z.number().int().min(-10000).max(10000).refine((n) => n !== 0, "Montant nul"),
  reason: z.string().max(200).optional(),
});

// Ajouter (ou retirer) des crédits à un utilisateur
router.post(
  "/users/:id/credits",
  ah(async (req, res) => {
    const body = creditsSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: req.params.id } });
      if (!user) throw new HttpError(404, "Utilisateur introuvable");
      if (user.credits + body.amount < 0) throw new HttpError(400, "Le solde ne peut pas être négatif");
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { credits: { increment: body.amount } },
      });
      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          type: body.amount > 0 ? "admin_grant" : "admin_debit",
          amount: body.amount,
          balanceAfter: updated.credits,
          description: body.reason || "Ajustement par un administrateur",
        },
      });
      return updated;
    });
    await audit(req.user!.id, "user.credits", "User", result.id, { amount: body.amount });
    res.json({ id: result.id, credits: result.credits });
  })
);

router.get(
  "/api-keys",
  ah(async (_req, res) => {
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
  })
);

const addKeySchema = z.object({
  key: z.string().trim().min(8, "Clé trop courte").max(512),
  provider: z.string().default("agnes"),
});

router.post(
  "/api-keys",
  ah(async (req, res) => {
    const body = addKeySchema.parse(req.body);
    const row = await prisma.apiKey.create({
      data: {
        encryptedKey: encrypt(body.key),
        maskedKey: maskKey(body.key),
        provider: body.provider,
        status: "active",
      },
    });
    await audit(req.user!.id, "api_key.create", "ApiKey", row.id);
    res.status(201).json({ id: row.id, maskedKey: row.maskedKey, status: row.status });
  })
);

router.patch(
  "/api-keys/:id",
  ah(async (req, res) => {
    const status = z.enum(["active", "disabled"]).parse(req.body?.status);
    const row = await prisma.apiKey.update({
      where: { id: req.params.id },
      data: { status, ...(status === "active" ? { disabledUntil: null } : {}) },
    });
    await audit(req.user!.id, `api_key.${status}`, "ApiKey", row.id);
    res.json({ id: row.id, status: row.status, maskedKey: row.maskedKey });
  })
);

router.delete(
  "/api-keys/:id",
  ah(async (req, res) => {
    await prisma.apiKey.delete({ where: { id: req.params.id } });
    await audit(req.user!.id, "api_key.delete", "ApiKey", req.params.id);
    res.json({ ok: true });
  })
);

router.get(
  "/generations",
  ah(async (_req, res) => {
    const gens = await prisma.videoGeneration.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        userId: true,
        mode: true,
        prompt: true,
        status: true,
        progress: true,
        format: true,
        durationSeconds: true,
        creditsUsed: true,
        creditStatus: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
        user: { select: { email: true } },
      },
    });
    res.json({ generations: gens });
  })
);

export default router;
