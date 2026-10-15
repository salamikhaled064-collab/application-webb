/**
 * MockVideoProvider – développement et tests sans clé API.
 *
 * SANS ÉTAT : l'avancement est calculé à partir de l'horodatage encodé dans
 * l'identifiant du job (mock_<timestamp>_<random>). Ainsi l'API, le worker ou un
 * redémarrage du serveur donnent toujours le même résultat (l'ancienne version
 * gardait les jobs dans une Map mémoire : "Job mock introuvable" dès que le
 * worker tournait dans un autre processus).
 */

import type {
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoProvider,
} from "./types";

const MOCK_DURATION_MS = 8000;

/** Petite vidéo de démonstration (~1 Mo) – l'ancienne faisait ~150 Mo. */
export const MOCK_VIDEO_URL =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

export class MockVideoProvider implements VideoProvider {
  readonly name = "mock";

  async createVideo(
    _request: VideoGenerationRequest,
    _apiKey: string,
    _signal?: AbortSignal
  ): Promise<VideoGenerationResult> {
    const id = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return { providerJobId: id, status: "queued", progress: 0 };
  }

  async getVideoStatus(
    providerJobId: string,
    _apiKey: string,
    _signal?: AbortSignal
  ): Promise<VideoGenerationResult> {
    const created = Number(providerJobId.split("_")[1]);
    if (!Number.isFinite(created)) {
      return { providerJobId, status: "failed", errorMessage: "Identifiant mock invalide." };
    }

    const elapsed = Date.now() - created;
    if (elapsed >= MOCK_DURATION_MS) {
      return { providerJobId, status: "completed", progress: 100, videoUrl: MOCK_VIDEO_URL };
    }
    if (elapsed < 1500) {
      return { providerJobId, status: "queued", progress: 5 };
    }
    return {
      providerJobId,
      status: "processing",
      progress: Math.min(95, Math.max(10, Math.floor((elapsed / MOCK_DURATION_MS) * 100))),
    };
  }
}
