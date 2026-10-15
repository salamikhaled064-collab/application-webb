import { Router } from "express";
import { z } from "zod";
import * as authService from "../services/auth-service";
import { requireAuth } from "../middleware/auth";
import { config } from "../config";

const router = Router();

const registerSchema = z.object({
  email: z.string().email("E-mail invalide").max(255),
  password: z.string().min(8, "Minimum 8 caractères").max(128),
  name: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

function setSessionCookie(res: any, sessionId: string) {
  res.cookie("session_id", sessionId, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.cookieSameSite,
    maxAge: config.sessionMaxAgeMs,
    path: "/",
  });
}

function clearSessionCookie(res: any) {
  res.clearCookie("session_id", {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.cookieSameSite,
    path: "/",
  });
}

router.post("/register", async (req, res) => {
  try {
    const body = registerSchema.parse(req.body);
    const { user, sessionId } = await authService.register(body.email, body.password, body.name);
    setSessionCookie(res, sessionId);
    res.status(201).json({ user });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: err.errors[0]?.message || "Données invalides" });
    }
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Erreur serveur" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);
    const { user, sessionId } = await authService.login(body.email, body.password);
    setSessionCookie(res, sessionId);
    res.json({ user });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "Données invalides" });
    }
    // Always same message to avoid user enumeration
    const status = err.status === 401 ? 401 : err.status || 500;
    res.status(status).json({
      error: status === 401 ? "E-mail ou mot de passe incorrect" : err.message || "Erreur serveur",
    });
  }
});

router.post("/logout", requireAuth, async (req, res) => {
  if (req.sessionId) await authService.logout(req.sessionId);
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

export default router;
