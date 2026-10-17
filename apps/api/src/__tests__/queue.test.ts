import { describe, it, expect, vi, beforeAll } from "vitest";

let q: typeof import("../queues/generation-queue");

beforeAll(async () => {
  process.env.DATABASE_URL = "postgresql://x:y@localhost:5432/z";
  process.env.GENERATION_CONCURRENCY = "2";
  delete process.env.REDIS_URL;
  q = await import("../queues/generation-queue");
});

const tick = () => new Promise((r) => setTimeout(r, 5));

describe("file d'attente mémoire", () => {
  it("traite plusieurs travaux en parallèle : un travail lent ne bloque pas les autres", async () => {
    const started: string[] = [];
    const releases: Record<string, () => void> = {};
    q.setJobHandler(
      (data) =>
        new Promise<void>((resolve) => {
          started.push(data.generationId);
          releases[data.generationId] = resolve;
        })
    );

    await q.enqueueGeneration("slow-1"); // reste bloqué
    await q.enqueueGeneration("fast-2");
    await q.enqueueGeneration("fast-3"); // 3e : doit attendre une place libre (concurrence = 2)
    await tick();
    expect(started).toEqual(["slow-1", "fast-2"]);

    releases["fast-2"]();
    await tick();
    expect(started).toEqual(["slow-1", "fast-2", "fast-3"]); // fast-3 passe sans attendre slow-1
    releases["slow-1"]();
    releases["fast-3"]();
  });

  it("ne met pas deux fois le même travail en file", async () => {
    const seen: string[] = [];
    let release!: () => void;
    q.setJobHandler(
      (data) =>
        new Promise<void>((resolve) => {
          seen.push(data.generationId);
          release = resolve;
        })
    );
    await q.enqueueGeneration("dup-a");
    await q.enqueueGeneration("dup-b");
    await q.enqueueGeneration("dup-c");
    await q.enqueueGeneration("dup-c");
    await tick();
    expect(seen).toEqual(["dup-a", "dup-b"]);
    release();
  });
});
