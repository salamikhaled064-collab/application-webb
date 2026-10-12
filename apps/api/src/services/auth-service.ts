import argon2 from "argon2";
import { prisma } from "../lib/prisma";
import { config } from "../config";
import { randomToken } from "../lib/crypto";

export async function register(email: string, password: string, name?: string) {
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    throw Object.assign(new Error("Cet e-mail est déjà utilisé"), { status: 409 });
  }

  if (password.length < 8) {
    throw Object.assign(new Error("Le mot de passe doit contenir au moins 8 caractères"), { status: 400 });
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      passwordHash,
      name: name?.trim() || null,
      credits: config.defaultUserCredits,
      role: "user",
    },
  });

  const session = await createSession(user.id);
  return { user: sanitizeUser(user), sessionId: session.id };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    throw Object.assign(new Error("E-mail ou mot de passe incorrect"), { status: 401 });
  }

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) {
    throw Object.assign(new Error("E-mail ou mot de passe incorrect"), { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeenAt: new Date() },
  });

  const session = await createSession(user.id);
  return { user: sanitizeUser(user), sessionId: session.id };
}

export async function logout(sessionId: string) {
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
}

async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + config.sessionMaxAgeMs);
  return prisma.session.create({
    data: {
      id: randomToken(24),
      userId,
      expiresAt,
    },
  });
}

function sanitizeUser(user: { id: string; email: string; name: string | null; role: string; credits: number }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    credits: user.credits,
  };
}
