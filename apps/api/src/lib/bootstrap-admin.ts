import argon2 from "argon2";
import { prisma } from "./prisma";
import { config, safeLog } from "../config";

/**
 * Crée / met à jour le compte administrateur au démarrage si
 * ADMIN_BOOTSTRAP_EMAIL et ADMIN_BOOTSTRAP_PASSWORD sont définis.
 * Remplace `npm run admin:create` (qui nécessite le Shell Render, payant).
 * Idempotent. Supprimez le mot de passe des variables d'environnement après le premier démarrage.
 */
export async function bootstrapAdmin() {
  const { email, password } = config.adminBootstrap;
  if (!email || !password) return;

  if (!email.includes("@") || password.length < 8) {
    safeLog("admin", "ADMIN_BOOTSTRAP ignoré : e-mail invalide ou mot de passe < 8 caractères");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // On ne réécrit le mot de passe que s'il a changé, pour ne pas ralentir chaque démarrage.
    let samePassword = false;
    try {
      samePassword = await argon2.verify(existing.passwordHash, password);
    } catch {
      samePassword = false;
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "admin",
        ...(samePassword
          ? {}
          : { passwordHash: await argon2.hash(password, { type: argon2.argon2id }) }),
      },
    });
    safeLog("admin", "Compte administrateur mis à jour");
  } else {
    await prisma.user.create({
      data: {
        email,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        role: "admin",
        name: "Admin",
        credits: 100,
      },
    });
    safeLog("admin", "Compte administrateur créé");
  }
}
