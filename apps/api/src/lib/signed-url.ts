import crypto from "crypto";
import { config } from "../config";

/**
 * URL publique SIGNÉE et temporaire pour qu'Agnes puisse télécharger l'image de départ.
 * L'image reste privée : sans signature valide (HMAC) ou après expiration, l'accès est refusé.
 */
function sign(id: string, exp: number): string {
  return crypto.createHmac("sha256", config.sessionSecret).update(`${id}.${exp}`).digest("hex");
}

export function buildSignedUploadUrl(uploadId: string, ttlSeconds = 2 * 60 * 60): string | null {
  if (!config.publicBaseUrl) return null;
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${config.publicBaseUrl}/api/public/uploads/${encodeURIComponent(uploadId)}?exp=${exp}&sig=${sign(uploadId, exp)}`;
}

export function verifySignedUpload(id: string, exp: unknown, sig: unknown): boolean {
  const e = Number(exp);
  if (!Number.isFinite(e) || e < Math.floor(Date.now() / 1000)) return false;
  if (typeof sig !== "string" || sig.length !== 64) return false;
  const expected = sign(id, e);
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
