import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { config } from "../config";

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";

export function issueCsrfToken(req: Request, res: Response) {
  let token = req.cookies?.[CSRF_COOKIE];
  if (!token || typeof token !== "string" || token.length < 16) {
    token = crypto.randomBytes(32).toString("hex");
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // readable by JS for X-CSRF-Token
      secure: config.isProd,
      sameSite: config.isProd ? "none" : "lax",
      maxAge: config.sessionMaxAgeMs,
      path: "/",
    });
  }
  return token;
}

/**
 * CSRF protection for state-changing methods.
 * Exempt: GET, HEAD, OPTIONS, and /api/health
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.path === "/api/health" || req.path === "/health") return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: "CSRF token invalide ou manquant" });
  }

  // Origin check when present
  const origin = req.headers.origin;
  if (origin && origin !== config.webUrl) {
    return res.status(403).json({ error: "Origine non autorisée" });
  }

  next();
}
