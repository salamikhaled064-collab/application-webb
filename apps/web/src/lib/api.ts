/**
 * Client API centralisé.
 *
 * Toutes les requêtes passent par /api/* sur le MÊME domaine que le site
 * (voir app/api/[...path]/route.ts, qui relaie vers l'API). Plus de CORS, plus de
 * cookies tiers, plus besoin de NEXT_PUBLIC_API_URL au build.
 */

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** Chemin à utiliser pour <video src>, <a href>, etc. (toujours same-origin) */
export function apiUrl(path: string): string {
  return path;
}

/** Conservé pour compatibilité : l'API est désormais toujours jointe en same-origin. */
export function getApiUrl(): string {
  return "";
}

export function getNetworkErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) {
    return "Connexion impossible. Vérifiez votre connexion internet puis réessayez.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Une erreur inconnue est survenue.";
}

/** Prévient le Header (crédits, rôle) qu'il doit se rafraîchir. */
export function notifyAuthChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("auth:refresh"));
}

let csrfToken = "";

async function getCsrfToken(force = false): Promise<string> {
  if (csrfToken && !force) return csrfToken;
  const res = await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
  if (!res.ok) throw await toError(res);
  const data = await res.json().catch(() => ({}));
  csrfToken = data.csrfToken || data.token || "";
  return csrfToken;
}

async function toError(res: Response): Promise<ApiError> {
  let message = "";
  let code: string | undefined;
  try {
    const body = await res.json();
    message = body.error || body.message || "";
    code = body.code;
  } catch {
    /* corps non JSON */
  }
  if (!message) {
    if (res.status === 401) message = "Session expirée. Reconnectez-vous.";
    else if (res.status === 402) message = "Crédits insuffisants.";
    else if (res.status === 403) message = "Accès refusé.";
    else if (res.status === 404) message = "Introuvable.";
    else if (res.status === 429) message = "Trop de requêtes. Patientez un instant.";
    else if (res.status >= 502 && res.status <= 504)
      message = "Le serveur démarre ou est indisponible. Réessayez dans 30 secondes.";
    else message = "Une erreur serveur est survenue.";
  }
  return new ApiError(message, res.status, code);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit & { skipJson?: boolean } = {}
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const isWrite = ["POST", "PATCH", "PUT", "DELETE"].includes(method);

  const baseHeaders: Record<string, string> = { ...(options.headers as Record<string, string>) };
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isForm && options.body && !baseHeaders["Content-Type"]) {
    baseHeaders["Content-Type"] = "application/json";
  }

  let csrfRetried = false;
  let transientRetries = method === "GET" ? 2 : 0; // une API en veille se réveille en ~30 s

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const headers = { ...baseHeaders };
    if (isWrite) {
      try {
        headers["X-CSRF-Token"] = await getCsrfToken(csrfRetried);
      } catch (e) {
        if (transientRetries-- > 0) {
          await sleep(2500);
          continue;
        }
        throw e instanceof ApiError ? e : new ApiError(getNetworkErrorMessage(e), 0);
      }
    }

    let res: Response;
    try {
      res = await fetch(path, {
        ...options,
        credentials: "same-origin",
        headers,
        cache: "no-store",
      });
    } catch (err) {
      if (transientRetries-- > 0) {
        await sleep(2500);
        continue;
      }
      throw new ApiError(getNetworkErrorMessage(err), 0);
    }

    if (res.status >= 502 && res.status <= 504 && transientRetries-- > 0) {
      await sleep(3000);
      continue;
    }

    if (res.status === 403 && isWrite && !csrfRetried) {
      const err = await toError(res.clone());
      if (err.code === "CSRF") {
        csrfRetried = true;
        csrfToken = "";
        continue;
      }
    }

    if (!res.ok) throw await toError(res);

    if (options.skipJson || res.status === 204) return undefined as T;
    return res.json();
  }
}
