/**
 * Secure admin bootstrap – NEVER put real passwords in code or Git.
 *
 * Usage:
 *   ADMIN_BOOTSTRAP_EMAIL=admin@example.com \
 *   ADMIN_BOOTSTRAP_PASSWORD='long-temporary-password' \
 *   npm run admin:create
 *
 * Then delete the env vars from the host / Render dashboard.
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config();

import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const WEAK = [
  "password",
  "password123",
  "admin",
  "admin123",
  "12345678",
  "qwerty",
  "changeme",
];

async function main() {
  const emailRaw = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!emailRaw || !password) {
    console.error(
      "Erreur: définissez ADMIN_BOOTSTRAP_EMAIL et ADMIN_BOOTSTRAP_PASSWORD"
    );
    process.exit(1);
  }

  const email = emailRaw.trim().toLowerCase();
  if (!email.includes("@") || email.length < 5) {
    console.error("Erreur: e-mail invalide");
    process.exit(1);
  }

  const minLen = process.env.NODE_ENV === "production" ? 12 : 8;
  if (password.length < minLen) {
    console.error(`Erreur: mot de passe trop court (min ${minLen})`);
    process.exit(1);
  }

  if (WEAK.some((w) => password.toLowerCase().includes(w))) {
    console.error("Erreur: mot de passe trop faible");
    process.exit(1);
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  });

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "admin",
        passwordHash,
      },
    });
    console.log("Compte administrateur configuré avec succès.");
  } else {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "admin",
        name: "Admin",
        credits: 100,
      },
    });
    console.log("Compte administrateur configuré avec succès.");
  }
}

main()
  .catch((err) => {
    console.error("Échec:", err.message || "erreur");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
