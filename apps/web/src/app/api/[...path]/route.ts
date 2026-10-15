/**
 * Proxy same-origin : le navigateur appelle /api/* sur le domaine du FRONTEND,
 * et ce handler relaie la requête vers l'API (variable d'environnement RUNTIME API_URL).
 *
 * Pourquoi : appeler l'API directement sur un autre domaine *.onrender.com échoue
 * ("Failed to fetch") dès que le navigateur bloque les cookies tiers (Opera, Brave,
 * Safari, Chrome récent), que le CORS est mal réglé, ou que NEXT_PUBLIC_API_URL
 * n'a pas été définie AU BUILD. En same-origin, plus rien de tout cela ne peut casser.
 */
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function upstreamBase(): string {
  let url =
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV !== "production" ? "http://localhost:3001" : "");
  url = url.trim().replace(/\/+$/, "");
  // Render "hostport" (réseau privé) arrive sans schéma : "ai-video-api:10000"
  if (url && !/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url;
}

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "trailer",
  "upgrade",
  "proxy-authorization",
  "proxy-authenticate",
  "host",
  "content-length",
  "content-encoding", // fetch décompresse déjà le corps
  "expect", // "100-continue" est refusé par le fetch de Node (undici) : l'upload échouait
]);

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function relay(req: NextRequest, { params }: { params: { path: string[] } }) {
  const base = upstreamBase();
  if (!base) {
    return json(
      503,
      "Le serveur n'est pas configuré : la variable API_URL est manquante sur le service web."
    );
  }

  const target = `${base}/api/${(params.path || []).map(encodeURIComponent).join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (HOP_BY_HOP.has(k) || k === "origin" || k === "referer") return;
    headers.set(key, value);
  });
  // IP réelle du visiteur (pour le rate-limit de l'API) : une seule valeur, pas de chaîne
  const clientIp =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "";
  if (clientIp) headers.set("x-forwarded-for", clientIp);

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(110_000), // marge pour le réveil d'une API Render en veille
    });
  } catch (err: any) {
    const timeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    return json(
      502,
      timeout
        ? "L'API met trop de temps à répondre (elle est peut-être en train de démarrer). Réessayez dans 30 secondes."
        : "Impossible de joindre l'API. Vérifiez qu'elle est en ligne (page /api/health) et que API_URL est correcte."
    );
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase()) || key.toLowerCase() === "set-cookie") return;
    out.set(key, value);
  });
  // Plusieurs Set-Cookie (session + csrf) doivent rester séparés
  const cookies =
    typeof (upstream.headers as any).getSetCookie === "function"
      ? (upstream.headers as any).getSetCookie()
      : [];
  for (const c of cookies) out.append("set-cookie", c);

  const noBody = [101, 204, 205, 304].includes(upstream.status) || (upstream.status >= 300 && upstream.status < 400);
  return new Response(noBody ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}

export const GET = relay;
export const POST = relay;
export const PUT = relay;
export const PATCH = relay;
export const DELETE = relay;
export const OPTIONS = relay;
