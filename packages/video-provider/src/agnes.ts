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

function buildCreatePayload(request: VideoGenerationRequest) {
  const payload: Record<string, unknown> = {
    model: request.model,
    prompt: request.prompt,
    width: request.width,
    height: request.height,
    num_frames: request.numFrames,
    frame_rate: request.frameRate,
  };
  // Only include image when present – never send "" for PROMPT_ONLY
  if (request.image && request.image.length > 0) {
    payload.image = request.image;
  }
  return payload;
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
      const message =
        json?.error?.message ||
        json?.message ||
        bodyText ||
        `HTTP ${res.status}`;

      if (res.status === 429) {
        return {
          providerJobId: "",
          status: "failed",
          errorMessage: "Rate limit atteint (429). Réessayez plus tard.",
          raw: json,
        };
      }

      return {
        providerJobId: "",
        status: "failed",
        errorMessage: `Erreur Agnes: ${message}`,
        raw: json,
      };
    }

    // Format de réponse attendu (peut nécessiter adaptation selon la doc réelle)
    const jobId =
      json?.id ||
      json?.job_id ||
      json?.video_id ||
      json?.data?.id ||
      null;

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
    const url = `${this.config.baseUrl}${this.config.resultPath}/${providerJobId}`;

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
    if (["completed", "success", "done", "finished"].includes(statusRaw)) {
      status = "completed";
    } else if (["failed", "error", "cancelled"].includes(statusRaw)) {
      status = "failed";
    } else if (["queued", "pending", "waiting"].includes(statusRaw)) {
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
      errorMessage: status === "failed" ? json?.error || json?.message : undefined,
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
