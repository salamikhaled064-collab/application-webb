/**
 * Centralized API client.
 * NEXT_PUBLIC_API_URL is baked in at Next.js build time on Render.
 */

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

export function getApiUrl(): string {
  if (API_URL) return API_URL;

  // Development only – never fall back to localhost in production builds
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3001";
  }

  return "";
}

export function getNetworkErrorMessage(error: unknown): string {
  if (error instanceof TypeError) {
    return "Impossible de contacter le serveur. Vérifiez NEXT_PUBLIC_API_URL et que l'API est en ligne.";
  }
  if (error instanceof Error) return error.message;
  return "Une erreur inconnue est survenue.";
}

async function getCsrfToken(): Promise<string> {
  const base = getApiUrl();
  if (!base) return "";
  try {
    const res = await fetch(`${base}/api/auth/csrf`, { credentials: "include" });
    if (!res.ok) return "";
    const data = await res.json().catch(() => ({}));
    return data.csrfToken || data.token || "";
  } catch {
    return "";
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit & { skipJson?: boolean } = {}
): Promise<T> {
  const base = getApiUrl();
  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_API_URL est manquante. Configurez l'URL de l'API sur Render puis redéployez le frontend."
    );
  }

  const method = (options.method || "GET").toUpperCase();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isForm && options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    const csrf = await getCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...options,
      credentials: "include",
      headers,
    });
  } catch (err) {
    throw new Error(getNetworkErrorMessage(err));
  }

  if (response.status === 401) {
    throw Object.assign(new Error("Session expirée. Reconnectez-vous."), {
      status: 401,
    });
  }
  if (response.status === 403) {
    let message = "Accès refusé.";
    try {
      const body = await response.json();
      message = body.error || body.message || message;
    } catch {
      /* */
    }
    throw Object.assign(new Error(message), { status: 403 });
  }

  if (!response.ok) {
    let message = "Une erreur serveur est survenue";
    try {
      const body = await response.json();
      message = body.error || body.message || message;
    } catch {
      /* */
    }
    if (response.status === 402) {
      message = message || "Crédits insuffisants.";
    }
    throw Object.assign(new Error(message), { status: response.status });
  }

  if (options.skipJson || response.status === 204) return undefined as T;
  return response.json();
}
