/**
 * MockVideoProvider – permet de développer et tester sans clé API réelle.
 * Simule une génération qui passe par les états queued → processing → completed.
 */

import type {
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoProvider,
} from "./types";

const jobs = new Map<
  string,
  {
    createdAt: number;
    request: VideoGenerationRequest;
    status: VideoGenerationResult["status"];
  }
>();

export class MockVideoProvider implements VideoProvider {
  readonly name = "mock";

  async createVideo(
    request: VideoGenerationRequest,
    _apiKey: string,
    _signal?: AbortSignal
  ): Promise<VideoGenerationResult> {
    const id = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    jobs.set(id, {
      createdAt: Date.now(),
      request,
      status: "queued",
    });

    // Simule un passage rapide à processing
    setTimeout(() => {
      const job = jobs.get(id);
      if (job) job.status = "processing";
    }, 1500);

    // Simule la completion après ~8 secondes
    setTimeout(() => {
      const job = jobs.get(id);
      if (job) job.status = "completed";
    }, 8000);

    return {
      providerJobId: id,
      status: "queued",
      progress: 0,
    };
  }

  async getVideoStatus(
    providerJobId: string,
    _apiKey: string,
    _signal?: AbortSignal
  ): Promise<VideoGenerationResult> {
    const job = jobs.get(providerJobId);

    if (!job) {
      return {
        providerJobId,
        status: "failed",
        errorMessage: "Job mock introuvable.",
      };
    }

    const elapsed = Date.now() - job.createdAt;
    let progress = 0;

    if (job.status === "queued") progress = 5;
    else if (job.status === "processing") {
      progress = Math.min(95, Math.floor((elapsed / 8000) * 100));
    } else if (job.status === "completed") progress = 100;

    // URL de démonstration (vidéo publique libre de droits)
    const videoUrl =
      job.status === "completed"
        ? "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
        : undefined;

    return {
      providerJobId,
      status: job.status,
      progress,
      videoUrl,
    };
  }
}
