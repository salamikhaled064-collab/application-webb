/**
 * Generation queue: BullMQ (Redis) when REDIS_URL is set,
 * otherwise in-process fallback for local/dev without Redis.
 */
import { config, safeLog } from "../config";

export interface GenerationJobData {
  generationId: string;
}

type JobHandler = (data: GenerationJobData) => Promise<void>;

let handler: JobHandler | null = null;
const memoryQueue: string[] = [];
let memoryProcessing = false;

// BullMQ types kept optional so project builds without redis installed yet
let bullQueue: any = null;
let bullConnection: any = null;

export async function initQueue() {
  if (!config.redisUrl) {
    safeLog("queue", "REDIS_URL not set – using in-memory queue (jobs lost on restart)");
    return;
  }
  try {
    // Dynamic import so the package is optional until installed
    const { Queue } = await import("bullmq");
    const IORedis = (await import("ioredis")).default;
    bullConnection = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    bullQueue = new Queue(config.queue.name, { connection: bullConnection });
    safeLog("queue", `BullMQ connected (${config.queue.name})`);
  } catch (err: any) {
    safeLog("queue", `BullMQ init failed, falling back to memory: ${err.message}`);
    bullQueue = null;
  }
}

export function setJobHandler(fn: JobHandler) {
  handler = fn;
  processMemoryQueue();
}

/**
 * Enqueue a generation job. Uses jobId = generationId for idempotency.
 */
export async function enqueueGeneration(generationId: string): Promise<void> {
  if (bullQueue) {
    await bullQueue.add(
      "generate",
      { generationId } satisfies GenerationJobData,
      {
        jobId: generationId, // idempotent: same id won't be added twice
        attempts: config.queue.maxAttempts,
        backoff: { type: "exponential", delay: config.queue.backoffMs },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
      }
    );
    safeLog("queue", "Job enqueued (BullMQ)", { generationId });
    return;
  }

  // In-memory fallback
  if (!memoryQueue.includes(generationId)) {
    memoryQueue.push(generationId);
    safeLog("queue", "Job enqueued (memory)", { generationId });
  }
  processMemoryQueue();
}

async function processMemoryQueue() {
  if (memoryProcessing || !handler || memoryQueue.length === 0) return;
  memoryProcessing = true;
  while (memoryQueue.length > 0) {
    const id = memoryQueue.shift()!;
    try {
      await handler({ generationId: id });
    } catch (err: any) {
      console.error(`[queue] memory job ${id} failed:`, err.message);
    }
  }
  memoryProcessing = false;
}

export async function closeQueue() {
  if (bullQueue) await bullQueue.close().catch(() => {});
  if (bullConnection) await bullConnection.quit().catch(() => {});
}

export function getBullConnection() {
  return bullConnection;
}

export function getQueueName() {
  return config.queue.name;
}
