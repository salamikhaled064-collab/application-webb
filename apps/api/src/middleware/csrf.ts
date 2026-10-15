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
      httpOnly: false, // lisible par JS pour l'en-tête X-CSRF-Token
      secure: config.isProd,
      sameSite: config.cookieSameSite,
      maxAge: config.sessionMaxAgeMs,
      path: "/",
    });
  }
  return token as string;
}

/**
 * Protection CSRF pour les méthodes qui modifient l'état.
 * Exemptés : GET, HEAD, OPTIONS et les routes de santé.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.path === "/api/health" || req.path === "/health") return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      error: "Session de sécurité expirée. Rechargez la page puis réessayez.",
      code: "CSRF",
    });
  }

  // Vérification de l'origine quand elle est présente (compare sans slash final)
  const origin = req.headers.origin;
  if (origin && !config.allowedOrigins.includes(String(origin).replace(/\/+$/, ""))) {
    return res.status(403).json({ error: "Origine non autorisée", code: "ORIGIN" });
  }

  next();
}
