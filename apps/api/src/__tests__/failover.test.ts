/**
 * Bascule automatique entre clés ET entre fournisseurs (BytePlus d'abord, puis Agnes).
 * Base de données et fournisseurs sont simulés : on teste la logique réelle du worker.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  process.env.DATABASE_URL = "postgresql://x:y@localhost:5432/z";
  process.env.VIDEO_PROVIDER = "auto";
  process.env.AGNES_POLL_INTERVAL_MS = "1";
  delete process.env.BYTEPLUS_API_KEY;
  delete process.env.AGNES_API_KEY;
  return {
    keys: [] as any[],
    gen: null as any,
    calls: [] as string[],
    behavior: {} as Record<string, string>,
  };
});

function applyData(target: any, data: any) {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === "object" && "increment" in (v as any)) target[k] = (target[k] ?? 0) + (v as any).increment;
    else target[k] = v;
  }
}

vi.mock("../lib/prisma", () => ({
  prisma: {
    videoGeneration: {
      findUnique: vi.fn(async () => ({ ...h.gen })),
      update: vi.fn(async ({ data }: any) => {
        applyData(h.gen, data);
        return h.gen;
      }),
    },
    apiKey: {
      findMany: vi.fn(async ({ where }: any) =>
        h.keys
          .filter(
            (k) =>
              k.provider === where.provider &&
              where.status.in.includes(k.status) &&
              (!k.disabledUntil || k.disabledUntil < new Date())
          )
          .sort((a, b) => (a.lastUsedAt?.getTime() ?? 0) - (b.lastUsedAt?.getTime() ?? 0))
      ),
      update: vi.fn(async ({ where, data }: any) => {
        const k = h.keys.find((x) => x.id === where.id);
        if (k) applyData(k, data);
        return k;
      }),
      findUnique: vi.fn(async ({ where }: any) => h.keys.find((x) => x.id === where.id) ?? null),
      count: vi.fn(async () => 0),
    },
  },
}));
vi.mock("../services/credit-service", () => ({ chargeCredits: vi.fn(), refundCredits: vi.fn() }));
vi.mock("../services/storage-service", () => ({
  downloadVideoToStorage: vi.fn(async () => ({ storageKey: "videos/x.mp4", bytes: 1 })),
  getObjectBuffer: vi.fn(),
  getAbsolutePath: vi.fn(),
}));
vi.mock("../queues/generation-queue", () => ({
  setJobHandler: vi.fn(),
  enqueueGeneration: vi.fn(),
  initQueue: vi.fn(),
  closeQueue: vi.fn(),
  getBullConnection: vi.fn(() => null),
  getQueueName: vi.fn(() => "q"),
}));
vi.mock("@ai-video/video-provider", () => {
  class Fake {
    constructor(public name: string) {}
    async createVideo(_req: any, key: string) {
      h.calls.push(`${this.name}:${key}`);
      const kind = h.behavior[key];
      if (kind) return { providerJobId: "", status: "failed", errorKind: kind, errorMessage: `${kind} (${key})` };
      return { providerJobId: `job-${key}`, status: "queued" };
    }
    async getVideoStatus(id: string) {
      return { providerJobId: id, status: "completed", progress: 100, videoUrl: "https://cdn.test/v.mp4" };
    }
  }
  return {
    BytePlusVideoProvider: class extends Fake { constructor() { super("byteplus"); } },
    AgnesVideoProvider: class extends Fake { constructor() { super("agnes"); } },
    MockVideoProvider: class extends Fake { constructor() { super("mock"); } },
  };
});

import { encrypt } from "../lib/crypto";
import { processGeneration, TemporaryError } from "../workers/generation-worker";

let seq = 0;
function addKey(provider: string, key: string) {
  h.keys.push({
    id: `k${++seq}`,
    provider,
    encryptedKey: encrypt(key),
    maskedKey: key,
    status: "active",
    disabledUntil: null,
    lastUsedAt: null,
    usageCount: 0,
    successCount: 0,
    errorCount: 0,
    rateLimitCount: 0,
    lastError: null,
  });
}
const key = (name: string) => h.keys.find((k) => k.maskedKey === name);

beforeEach(() => {
  h.keys = [];
  h.calls = [];
  h.behavior = {};
  h.gen = {
    id: "g1", userId: "u1", status: "pending", mode: "PROMPT_ONLY", upload: null, prompt: "p", finalPrompt: "p",
    format: "9:16", durationSeconds: 6, width: 720, height: 1280, numFrames: 145, frameRate: 24,
    provider: "auto", creditsUsed: 2, apiKeyId: null,
  };
});

describe("bascule automatique des clés", () => {
  it("BytePlus passe en premier", async () => {
    addKey("agnes", "ag-1");
    addKey("byteplus", "bp-1");
    await processGeneration({ generationId: "g1" });
    expect(h.calls[0]).toBe("byteplus:bp-1");
    expect(h.gen.provider).toBe("byteplus");
    expect(h.gen.status).toBe("completed");
  });

  it("clé refusée puis quota épuisé : passe à la 3e clé et désactive les deux premières", async () => {
    addKey("byteplus", "bp-bad");
    addKey("byteplus", "bp-quota");
    addKey("byteplus", "bp-good");
    h.behavior = { "bp-bad": "auth", "bp-quota": "quota" };
    await processGeneration({ generationId: "g1" });
    expect(h.calls).toEqual(["byteplus:bp-bad", "byteplus:bp-quota", "byteplus:bp-good"]);
    expect(key("bp-bad").status).toBe("disabled");
    expect(key("bp-bad").lastError).toContain("auth");
    expect(key("bp-quota").status).toBe("disabled");
    expect(key("bp-good").status).toBe("active");
    expect(key("bp-good").successCount).toBe(1);
    expect(h.gen.status).toBe("completed");
    expect(h.gen.apiKeyId).toBe(key("bp-good").id);
  });

  it("toutes les clés BytePlus épuisées : bascule sur Agnes", async () => {
    addKey("byteplus", "bp-1");
    addKey("byteplus", "bp-2");
    addKey("agnes", "ag-1");
    h.behavior = { "bp-1": "quota", "bp-2": "quota" };
    await processGeneration({ generationId: "g1" });
    expect(h.gen.provider).toBe("agnes");
    expect(h.gen.status).toBe("completed");
    expect(h.calls.at(-1)).toBe("agnes:ag-1");
  });

  it("limite 429 : la clé est mise en pause 1 minute et la suivante prend le relais", async () => {
    addKey("byteplus", "bp-rate");
    addKey("byteplus", "bp-good");
    h.behavior = { "bp-rate": "rate_limit" };
    await processGeneration({ generationId: "g1" });
    expect(key("bp-rate").status).toBe("cooldown");
    expect(key("bp-rate").disabledUntil.getTime()).toBeGreaterThan(Date.now());
    expect(key("bp-rate").rateLimitCount).toBe(1);
    expect(h.gen.status).toBe("completed");
  });

  it("une clé en pause n'est pas réutilisée avant la fin de sa pause", async () => {
    addKey("byteplus", "bp-paused");
    addKey("byteplus", "bp-good");
    key("bp-paused").status = "cooldown";
    key("bp-paused").disabledUntil = new Date(Date.now() + 60_000);
    await processGeneration({ generationId: "g1" });
    expect(h.calls).toEqual(["byteplus:bp-good"]);
  });

  it("une clé désactivée n'est jamais utilisée", async () => {
    addKey("byteplus", "bp-off");
    addKey("byteplus", "bp-good");
    key("bp-off").status = "disabled";
    await processGeneration({ generationId: "g1" });
    expect(h.calls).toEqual(["byteplus:bp-good"]);
  });

  it("saturation partout : erreur TEMPORAIRE (on réessaiera), clés non désactivées", async () => {
    addKey("byteplus", "bp-1");
    addKey("agnes", "ag-1");
    h.behavior = { "bp-1": "temporary", "ag-1": "temporary" };
    await expect(processGeneration({ generationId: "g1" })).rejects.toBeInstanceOf(TemporaryError);
    expect(key("bp-1").status).toBe("active");
    expect(key("ag-1").status).toBe("active");
    expect(h.gen.status).not.toBe("failed");
  });

  it("demande refusée (fatal) chez BytePlus : essaie Agnes, sans désactiver la clé", async () => {
    addKey("byteplus", "bp-1");
    addKey("byteplus", "bp-2");
    addKey("agnes", "ag-1");
    h.behavior = { "bp-1": "fatal", "bp-2": "fatal" };
    await processGeneration({ generationId: "g1" });
    expect(h.calls).toEqual(["byteplus:bp-1", "agnes:ag-1"]); // bp-2 sauté : inutile de réessayer la même demande
    expect(key("bp-1").status).toBe("active");
    expect(h.gen.provider).toBe("agnes");
  });

  it("toutes les clés inutilisables : échec définitif avec un message clair", async () => {
    addKey("byteplus", "bp-1");
    h.behavior = { "bp-1": "auth" };
    await processGeneration({ generationId: "g1" });
    expect(h.gen.status).toBe("failed");
    expect(h.gen.errorMessage).toContain("Aucune clé utilisable");
  });

  it("aucune clé en mode auto : mode démonstration", async () => {
    await processGeneration({ generationId: "g1" });
    expect(h.calls).toEqual(["mock:mock"]);
    expect(h.gen.provider).toBe("mock");
    expect(h.gen.status).toBe("completed");
  });

  it("répartition : la clé la moins récemment utilisée passe d'abord", async () => {
    addKey("byteplus", "bp-a");
    addKey("byteplus", "bp-b");
    key("bp-a").lastUsedAt = new Date(Date.now() - 1000);
    await processGeneration({ generationId: "g1" });
    expect(h.calls[0]).toBe("byteplus:bp-b");
  });
});
