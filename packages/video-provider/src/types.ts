/**
 * Interface générique pour tout fournisseur de génération vidéo IA.
 */

export type GenerationStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface VideoGenerationRequest {
  model: string;
  prompt: string;
  /** Ancien format (base64) – conservé pour compatibilité, non utilisé par Video 2.5 */
  image?: string;
  /** URL PUBLIQUE de l'image de départ (Agnes doit pouvoir la télécharger). Absente pour PROMPT_ONLY. */
  imageUrl?: string;
  /** Image de départ en base64 ("data:image/png;base64,...") – BytePlus l'accepte, sans URL publique */
  imageDataUrl?: string;
  /** Format de sortie : "9:16" | "16:9" | "1:1" | "3:4" | "4:3" | "21:9" */
  aspectRatio?: string;
  /** Durée du clip en secondes (Agnes Video 2.5 : 4 à 12) */
  seconds?: number;
  width?: number;
  height?: number;
  numFrames?: number;
  frameRate?: number;
  style?: string;
  durationSeconds?: number;
  mode?: "PROMPT_ONLY" | "IMAGE_TO_VIDEO";
}

/**
 * Nature d'un échec de création, utilisée pour décider quoi faire :
 *  auth       → clé refusée          : on désactive la clé et on essaie la suivante
 *  quota      → quota épuisé         : idem
 *  rate_limit → trop de requêtes     : pause courte de la clé, on essaie la suivante
 *  temporary  → saturation / réseau  : on essaie la suivante, puis on réessaie plus tard
 *  fatal      → demande refusée (contenu, paramètres) : inutile de changer de clé
 */
export type ProviderErrorKind = "auth" | "quota" | "rate_limit" | "temporary" | "fatal";

export function classifyError(status: number, text: string): ProviderErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (
    status === 402 ||
    /quota|exhaust|SetLimitExceeded|insufficient|balance|overdue|not activated|ModelNotOpen|payment/i.test(text)
  ) {
    return "quota";
  }
  if (status === 429) return "rate_limit";
  if (status >= 500 || status === 408) return "temporary";
  return "fatal";
}

export interface VideoGenerationResult {
  /** Renseigné quand status === "failed" à la création */
  errorKind?: ProviderErrorKind;
  providerJobId: string;
  status: GenerationStatus;
  progress?: number;
  videoUrl?: string;
  thumbnailUrl?: string;
  errorMessage?: string;
  raw?: unknown;
}

export interface VideoProvider {
  readonly name: string;

  createVideo(
    request: VideoGenerationRequest,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<VideoGenerationResult>;

  getVideoStatus(
    providerJobId: string,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<VideoGenerationResult>;

  downloadVideo?(videoUrl: string, signal?: AbortSignal): Promise<Buffer>;
}

export interface VideoPreset {
  width: number;
  height: number;
}

export interface VideoDuration {
  seconds: number;
  numFrames: number;
}

/** Formats réellement acceptés par Agnes Video 2.5 Flash (720P) */
export const VIDEO_PRESETS: Record<string, VideoPreset> = {
  "9:16": { width: 720, height: 1280 },
  "16:9": { width: 1280, height: 704 },
  "1:1": { width: 720, height: 720 },
  "3:4": { width: 720, height: 960 },
};

/** Agnes Video 2.5 : de 4 à 12 secondes par clip */
export const MIN_CLIP_SECONDS = 4;
export const MAX_CLIP_SECONDS = 12;

export const VIDEO_DURATIONS: Record<string, VideoDuration> = {
  "4": { seconds: 4, numFrames: 97 },
  "6": { seconds: 6, numFrames: 145 },
  "8": { seconds: 8, numFrames: 193 },
  "10": { seconds: 10, numFrames: 241 },
  "12": { seconds: 12, numFrames: 289 },
};

export const VIDEO_STYLES = [
  { id: "none", label: "Aucun style" },
  { id: "cinematic", label: "Cinématique" },
  { id: "realistic", label: "Réaliste" },
  { id: "artistic", label: "Artistique" },
  { id: "dynamic", label: "Dynamique" },
  { id: "anime", label: "Anime" },
] as const;

export type VideoStyleId = (typeof VIDEO_STYLES)[number]["id"];
