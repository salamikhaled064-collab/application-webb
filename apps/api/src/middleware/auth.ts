import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  credits: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionId?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.cookies?.session_id;
    if (!sessionId) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
      }
      res.clearCookie("session_id");
      return res.status(401).json({ error: "Session expirée" });
    }

    req.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      credits: session.user.credits,
    };
    req.sessionId = session.id;
    next();
  } catch (err) {
    console.error("[auth]", err);
    return res.status(500).json({ error: "Erreur d'authentification" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Accès administrateur requis" });
  }
  next();
}
