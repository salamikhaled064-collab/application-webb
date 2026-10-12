/**
 * Interface générique pour tout fournisseur de génération vidéo IA.
 * Permet de remplacer Agnes par un autre provider sans toucher au reste de l'application.
 */

export type GenerationStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

export interface VideoGenerationRequest {
  model: string;
  prompt: string;
  image: string; // base64 data URL ou URL publique selon le mode
  width: number;
  height: number;
  numFrames: number;
  frameRate: number;
  style?: string;
  durationSeconds?: number;
}

export interface VideoGenerationResult {
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

  downloadVideo?(
    videoUrl: string,
    signal?: AbortSignal
  ): Promise<Buffer>;
}

export interface VideoPreset {
  width: number;
  height: number;
}

export interface VideoDuration {
  seconds: number;
  numFrames: number;
}

export const VIDEO_PRESETS: Record<string, VideoPreset> = {
  "9:16": { width: 704, height: 1280 },
  "16:9": { width: 1280, height: 704 },
  "1:1": { width: 1024, height: 1024 },
  "4:5": { width: 864, height: 1080 },
};

export const VIDEO_DURATIONS: Record<string, VideoDuration> = {
  "3": { seconds: 3, numFrames: 81 },
  "5": { seconds: 5, numFrames: 121 },
  "10": { seconds: 10, numFrames: 241 },
  "18": { seconds: 18, numFrames: 441 },
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
