/**
 * BytePlus ModelArk – Seedance (génération vidéo asynchrone).
 * Documentation officielle :
 *  - Création : POST {base}/contents/generations/tasks   (Authorization: Bearer <ARK_API_KEY>)
 *  - Suivi    : GET  {base}/contents/generations/tasks/{id}
 *    statuts : queued | running | succeeded | failed | cancelled | expired
 *    résultat : content.video_url (valable 24 h)
 */
import type {
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoProvider,
  GenerationStatus,
} from "./types";
import { classifyError } from "./types";

export interface BytePlusConfig {
  /** ex : "seedance-1-5-pro-251215" (ou un ID de endpoint "ep-...") */
  model: string;
  /** ex : "https://ark.ap-southeast.bytepluses.com/api/v3" */
  baseUrl: string;
  /** "480p" | "720p" | "1080p" – 480p consomme ~2× moins de quota gratuit */
  resolution: string;
  /** Son synchronisé (modèles 1.5 pro / 2.x uniquement) */
  generateAudio: boolean;
  watermark: boolean;
  requestTimeoutMs: number;
  resultTimeoutMs: number;
}

/** generate_audio n'existe que sur certains modèles : l'envoyer aux autres provoque une erreur (validation stricte). */
function supportsAudio(model: string): boolean {
  return /seedance-1-5|seedance-2|dreamina-seedance/i.test(model);
}

export function buildBytePlusPayload(request: VideoGenerationRequest, cfg: BytePlusConfig) {
  const duration = Math.min(12, Math.max(4, Math.round(request.seconds ?? request.durationSeconds ?? 5)));

  const content: Array<Record<string, unknown>> = [{ type: "text", text: request.prompt }];
  const image = request.imageDataUrl || request.imageUrl;
  if (image) {
    content.push({ type: "image_url", image_url: { url: image }, role: "first_frame" });
  }

  const payload: Record<string, unknown> = {
    model: cfg.model,
    content,
    resolution: cfg.resolution,
    ratio: request.aspectRatio || "16:9",
    duration,
    watermark: cfg.watermark,
  };
  if (supportsAudio(cfg.model)) payload.generate_audio = cfg.generateAudio;
  return payload;
}

function errorInfo(json: any, bodyText: string, status: number): { code: string; message: string } {
  const e = json?.error;
  const code = (typeof e === "object" && e?.code) || json?.code || "";
  const message =
    (typeof e === "object" && e?.message) ||
    (typeof e === "string" && e) ||
    json?.message ||
    bodyText ||
    `HTTP ${status}`;
  return { code: String(code), message: String(message).slice(0, 300) };
}

/** Message clair en français pour les cas les plus fréquents. */
function friendly(status: number, code: string, message: string): string {
  const raw = `${code} ${message}`;
  if (status === 401 || status === 403 || /AuthenticationError|Unauthorized|InvalidApiKey/i.test(raw)) {
    return `Clé BytePlus refusée (${status}). Vérifiez la clé dans /admin. ${message}`;
  }
  if (/quota|exhaust|SetLimitExceeded|insufficient|balance|overdue|AccountOverdue/i.test(raw)) {
    return `Quota BytePlus épuisé ou modèle non activé : ${message}`;
  }
  if (/ModelNotOpen|not activated|not open|activate/i.test(raw)) {
    return `Modèle BytePlus non activé : activez-le dans la console ModelArk. ${message}`;
  }
  if (status === 429 || /RateLimit|TooManyRequests/i.test(raw)) {
    return `Rate limit atteint (429) chez BytePlus. Réessayez plus tard.`;
  }
  return `Erreur BytePlus (${status}) : ${message}`;
}

export class BytePlusVideoProvider implements VideoProvider {
  readonly name = "byteplus";

  constructor(private readonly config: BytePlusConfig) {}

  private headers(apiKey: string) {
    return { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
  }

  async createVideo(
    request: VideoGenerationRequest,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<VideoGenerationResult> {
    const url = `${this.config.baseUrl}/contents/generations/tasks`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: this.headers(apiKey),
        body: JSON.stringify(buildBytePlusPayload(request, this.config)),
        signal: signal ?? AbortSignal.timeout(this.config.requestTimeoutMs),
      });
    } catch (err: any) {
      return {
        providerJobId: "",
        status: "failed",
        errorMessage: `Erreur réseau BytePlus (timeout/network) : ${err?.message || "inconnue"}`,
        errorKind: "temporary",
      };
    }

    const bodyText = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(bodyText);
    } catch {
      /* corps non JSON */
    }

    if (!res.ok) {
      const { code, message } = errorInfo(json, bodyText, res.status);
      return {
        providerJobId: "",
        status: "failed",
        errorMessage: friendly(res.status, code, message),
        errorKind: classifyError(res.status, `${code} ${message}`),
        raw: json,
      };
    }

    const id = json?.id;
    if (!id) {
      return {
        providerJobId: "",
        status: "failed",
        errorMessage: "Réponse BytePlus inattendue : identifiant de tâche absent.",
        errorKind: "temporary",
        raw: json,
      };
    }
    return { providerJobId: String(id), status: "queued", progress: 0, raw: json };
  }

  async getVideoStatus(
    providerJobId: string,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<VideoGenerationResult> {
    const url = `${this.config.baseUrl}/contents/generations/tasks/${encodeURIComponent(providerJobId)}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: this.headers(apiKey),
        signal: signal ?? AbortSignal.timeout(this.config.resultTimeoutMs),
      });
    } catch (err: any) {
      // Problème réseau passager : on continue d'interroger
      return { providerJobId, status: "processing", errorMessage: `Erreur réseau : ${err?.message}` };
    }

    const bodyText = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(bodyText);
    } catch {
      /* corps non JSON */
    }

    if (!res.ok) {
      const { code, message } = errorInfo(json, bodyText, res.status);
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        return { providerJobId, status: "failed", errorMessage: friendly(res.status, code, message), raw: json };
      }
      return { providerJobId, status: "processing", errorMessage: `Erreur statut: HTTP ${res.status}`, raw: json };
    }

    const raw = String(json?.status || "").toLowerCase();
    let status: GenerationStatus = "processing";
    if (raw === "succeeded") status = "completed";
    else if (["failed", "cancelled", "canceled", "expired"].includes(raw)) status = "failed";
    else if (raw === "queued") status = "queued";

    if (status === "completed" && !json?.content?.video_url) {
      return { providerJobId, status: "processing", raw: json };
    }

    return {
      providerJobId,
      status,
      progress: status === "completed" ? 100 : undefined,
      videoUrl: json?.content?.video_url,
      errorMessage:
        status === "failed"
          ? json?.error?.message
            ? friendly(200, String(json.error.code || ""), String(json.error.message))
            : `Tâche BytePlus ${raw || "échouée"}`
          : undefined,
      raw: json,
    };
  }
}
