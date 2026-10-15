/**
 * Adaptateur Agnes AI – isolé.
 * Basé sur src/services/agnes.js du projet darkdeku225-ai-video.
 * Toute modification liée à Agnes se fait uniquement ici.
 */

import type {
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoProvider,
} from "./types";

export interface AgnesConfig {
  model: string;
  baseUrl: string;
  createPath: string;
  resultPath: string;
  requestTimeoutMs: number;
  resultTimeoutMs: number;
  imageMode: "base64" | "public_url" | "multipart";
}

/**
 * Corps de la requête POST /v1/videos pour Agnes Video 2.5 (doc officielle) :
 *  - mode "text"     : texte → vidéo
 *  - mode "keyframe" : la vidéo PART de l'image (first_frame = URL publique)
 * `seconds` est une CHAÎNE "4".."12". Flash n'accepte que size "720P".
 */
export function buildCreatePayload(request: VideoGenerationRequest) {
  const seconds = Math.min(12, Math.max(4, Math.round(request.seconds ?? request.durationSeconds ?? 5)));
  const payload: Record<string, unknown> = {
    model: request.model,
    prompt: request.prompt,
    seconds: String(seconds),
    mode: request.imageUrl ? "keyframe" : "text",
    aspect_ratio: request.aspectRatio || "16:9",
    n: 1,
  };
  if (/flash/i.test(request.model)) payload.size = "720P";
  // Jamais de chaîne vide pour le texte seul
  if (request.imageUrl && request.imageUrl.length > 0) {
    payload.first_frame = request.imageUrl;
  }
  return payload;
}

function errorText(json: any, bodyText: string, status: number): string {
  const d = json?.detail ?? json?.error?.message ?? json?.error ?? json?.message;
  if (typeof d === "string" && d) return d;
  if (d && typeof d === "object") return JSON.stringify(d).slice(0, 300);
  return (bodyText || `HTTP ${status}`).slice(0, 300);
}

async function httpJson(
  url: string,
  options: RequestInit & { timeoutMs?: number }
): Promise<{ res: Response; bodyText: string; json: any }> {
  const { timeoutMs = 60000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch {
      bodyText = "";
    }

    let json: any = null;
    try {
      json = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      json = null;
    }

    return { res, bodyText, json };
  } finally {
    clearTimeout(timeout);
  }
}

export class AgnesVideoProvider implements VideoProvider {
  readonly name = "agnes";
  private config: AgnesConfig;

  constructor(config: AgnesConfig) {
    this.config = config;
  }

  async createVideo(
    request: VideoGenerationRequest,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<VideoGenerationResult> {
    const url = `${this.config.baseUrl}${this.config.createPath}`;
    const payload = buildCreatePayload({
      ...request,
      model: this.config.model,
    });

    const { res, bodyText, json } = await httpJson(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      timeoutMs: this.config.requestTimeoutMs,
      signal,
    });

    if (!res.ok) {
      const message = errorText(json, bodyText, res.status);

      if (res.status === 429) {
        return {
          providerJobId: "",
          status: "failed",
          errorMessage: "Rate limit atteint (429). Réessayez plus tard.",
          raw: json,
        };
      }
      if (res.status === 401 || res.status === 403) {
        return {
          providerJobId: "",
          status: "failed",
          errorMessage: `Clé Agnes refusée (${res.status}). Vérifiez la clé dans /admin. ${message}`,
          raw: json,
        };
      }

      return {
        providerJobId: "",
        status: "failed",
        errorMessage: `Erreur Agnes (${res.status}) : ${message}`,
        raw: json,
      };
    }

    // La doc : "video_id" sert à récupérer le résultat ; "id"/"task_id" identifient la tâche.
    const jobId = json?.video_id || json?.id || json?.task_id || json?.data?.video_id || null;

    if (!jobId) {
      return {
        providerJobId: "",
        status: "failed",
        errorMessage: "Réponse Agnes invalide : identifiant de job manquant.",
        raw: json,
      };
    }

    return {
      providerJobId: String(jobId),
      status: "queued",
      progress: 0,
      raw: json,
    };
  }

  async getVideoStatus(
    providerJobId: string,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<VideoGenerationResult> {
    // GET /agnesapi?video_id=...&model_name=...  (model_name est obligatoire hors mode texte)
    const url =
      `${this.config.baseUrl}${this.config.resultPath}` +
      `?video_id=${encodeURIComponent(providerJobId)}&model_name=${encodeURIComponent(this.config.model)}`;

    const { res, bodyText, json } = await httpJson(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      timeoutMs: this.config.resultTimeoutMs,
      signal,
    });

    if (!res.ok) {
      if (res.status === 404) {
        return {
          providerJobId,
          status: "failed",
          errorMessage: "Job introuvable chez le fournisseur.",
          raw: json,
        };
      }

      if (res.status === 401 || res.status === 403) {
        return {
          providerJobId,
          status: "failed",
          errorMessage: `Clé Agnes refusée (${res.status}) pendant le suivi.`,
          raw: json,
        };
      }

      // 429 / 5xx : passager, on continue d'interroger
      return {
        providerJobId,
        status: "processing",
        errorMessage: `Erreur statut: HTTP ${res.status}`,
        raw: json,
      };
    }

    // Mapping flexible selon les formats possibles d'Agnes
    const statusRaw = (
      json?.status ||
      json?.state ||
      json?.data?.status ||
      ""
    ).toLowerCase();

    let status: VideoGenerationResult["status"] = "processing";
    if (["completed", "success", "succeeded", "done", "finished"].includes(statusRaw)) {
      status = "completed";
    } else if (["failed", "error", "cancelled", "canceled"].includes(statusRaw)) {
      status = "failed";
    } else if (["queued", "pending", "waiting", "submitted"].includes(statusRaw)) {
      status = "queued";
    }

    const videoUrl =
      json?.video_url ||
      json?.url ||
      json?.output?.url ||
      json?.data?.video_url ||
      json?.result?.url ||
      undefined;

    const progress =
      typeof json?.progress === "number"
        ? json.progress
        : typeof json?.percent === "number"
          ? json.percent
          : undefined;

    return {
      providerJobId,
      status,
      progress,
      videoUrl,
      errorMessage:
        status === "failed"
          ? (typeof json?.error === "string" ? json.error : json?.error?.message) ||
            json?.message ||
            json?.detail ||
            "Génération échouée chez le fournisseur"
          : undefined,
      raw: json,
    };
  }

  async downloadVideo(
    videoUrl: string,
    signal?: AbortSignal
  ): Promise<Buffer> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const res = await fetch(videoUrl, {
        signal: signal || controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Impossible de télécharger la vidéo: HTTP ${res.status}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } finally {
      clearTimeout(timeout);
    }
  }
}
