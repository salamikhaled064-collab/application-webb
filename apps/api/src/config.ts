import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config();

function required(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (!val) throw new Error(`Missing required env: ${key}`);
  return val;
}

function normalizeOrigin(value: string): string {
  const v = (value || "").trim().replace(/\/+$/, "");
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

const nodeEnv = process.env.NODE_ENV || "development";
const isProd = nodeEnv === "production";

/** Refuse weak/default secrets in production */
function secret(key: string, fallbackDev: string): string {
  const val = process.env[key];
  if (isProd) {
    if (!val || /change|replace|dev-|local-only|0123456789abcdef/i.test(val) || val.length < 32) {
      throw new Error(
        `[security] ${key} must be a strong random value in production (openssl rand -hex 32)`
      );
    }
    return val;
  }
  return val || fallbackDev;
}

export const config = {
  nodeEnv,
  isProd,
  port: parseInt(process.env.PORT || process.env.API_PORT || "3001", 10),
  webUrl: normalizeOrigin(process.env.WEB_URL || "http://localhost:3000"),
  /** Origines autorisées (CORS + CSRF). WEB_URL + WEB_URLS (liste séparée par des virgules). */
  allowedOrigins: [
    process.env.WEB_URL || "http://localhost:3000",
    ...(process.env.WEB_URLS || "").split(","),
  ]
    .map((o) => normalizeOrigin(o))
    .filter(Boolean),
  /**
   * "lax" (défaut) : le frontend appelle l'API via son proxy same-origin (/api/*).
   * "none" : uniquement si le navigateur appelle l'API directement sur un autre domaine.
   */
  cookieSameSite: (process.env.COOKIE_SAMESITE === "none" ? "none" : "lax") as "lax" | "none",
  /** Nombre de proxys devant l'API (Render + proxy Next = 1 grâce au X-Forwarded-For normalisé). */
  trustProxy: parseInt(process.env.TRUST_PROXY || "1", 10),
  adminBootstrap: {
    email: (process.env.ADMIN_BOOTSTRAP_EMAIL || "").trim().toLowerCase(),
    password: process.env.ADMIN_BOOTSTRAP_PASSWORD || "",
  },
  databaseUrl: required(
    "DATABASE_URL",
    isProd ? "" : "file:./data/app.sqlite"
  ),
  redisUrl: process.env.REDIS_URL || "",
  sessionSecret: secret("SESSION_SECRET", "dev-session-secret-change-me-local-only-32b"),
  encryptionKey: secret(
    "ENCRYPTION_KEY",
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  ),
  videoProvider: (process.env.VIDEO_PROVIDER || "mock") as "mock" | "agnes",
  agnes: {
    model: process.env.AGNES_MODEL || "agnes-video-v2.0",
    baseUrl: process.env.AGNES_BASE_URL || "https://apihub.agnes-ai.com",
    createPath: process.env.AGNES_CREATE_PATH || "/v1/videos",
    resultPath: process.env.AGNES_RESULT_PATH || "/agnesapi",
    frameRate: parseInt(process.env.AGNES_FRAME_RATE || "24", 10),
    pollIntervalMs: parseInt(process.env.AGNES_POLL_INTERVAL_MS || "4000", 10),
    pollMaxAttempts: parseInt(process.env.AGNES_POLL_MAX_ATTEMPTS || "150", 10),
    requestTimeoutMs: parseInt(process.env.AGNES_REQUEST_TIMEOUT_MS || "60000", 10),
    resultTimeoutMs: parseInt(process.env.AGNES_RESULT_TIMEOUT_MS || "30000", 10),
  },
  maxImageSizeMb: parseInt(process.env.MAX_IMAGE_SIZE_MB || "10", 10),
  maxVideoSizeMb: parseInt(process.env.MAX_VIDEO_SIZE_MB || "500", 10),
  storageDir: process.env.STORAGE_DIR || process.env.STORAGE_PATH || "./storage",
  storageProvider: (process.env.STORAGE_PROVIDER || "local") as "local" | "s3",
  videoRetentionDays: parseInt(process.env.VIDEO_RETENTION_DAYS || "7", 10),
  defaultUserCredits: parseInt(process.env.DEFAULT_USER_CREDITS || "5", 10),
  creditCosts: {
    3: parseInt(process.env.CREDITS_COST_3_SECONDS || "1", 10),
    5: parseInt(process.env.CREDITS_COST_5_SECONDS || "2", 10),
    10: parseInt(process.env.CREDITS_COST_10_SECONDS || "4", 10),
    18: parseInt(process.env.CREDITS_COST_18_SECONDS || "7", 10),
  } as Record<number, number>,
  sessionMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
  queue: {
    name: process.env.GENERATION_QUEUE_NAME || "video-generation",
    concurrency: parseInt(process.env.GENERATION_CONCURRENCY || "2", 10),
    maxAttempts: parseInt(process.env.GENERATION_MAX_ATTEMPTS || "3", 10),
    backoffMs: parseInt(process.env.GENERATION_BACKOFF_MS || "5000", 10),
  },
  runWorkerInApi:
    process.env.RUN_WORKER_IN_API === "true" ||
    (!process.env.REDIS_URL && nodeEnv !== "production"),
};

export const VIDEO_PRESETS: Record<string, { width: number; height: number }> = {
  "9:16": { width: 704, height: 1280 },
  "16:9": { width: 1280, height: 704 },
  "1:1": { width: 1024, height: 1024 },
  "4:5": { width: 864, height: 1080 },
};

export const VIDEO_DURATIONS: Record<number, { seconds: number; numFrames: number }> = {
  3: { seconds: 3, numFrames: 81 },
  5: { seconds: 5, numFrames: 121 },
  10: { seconds: 10, numFrames: 241 },
  18: { seconds: 18, numFrames: 441 },
};


// Fail fast if S3 is required but misconfigured
if (config.storageProvider === "s3") {
  const missing = ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].filter(
    (k) => !process.env[k]
  );
  if (missing.length) {
    throw new Error(
      `[security] STORAGE_PROVIDER=s3 but missing: ${missing.join(", ")}. ` +
        `Set S3_* env vars or use STORAGE_PROVIDER=local only for single-process dev.`
    );
  }
}


// Redis est optionnel : sans lui, file d'attente en mémoire + reprise au démarrage.
if (config.isProd && !config.redisUrl) {
  console.warn(
    "[config] REDIS_URL absent : file d'attente en mémoire (les générations en cours sont relancées au redémarrage)."
  );
}

export function safeLog(scope: string, message: string, meta?: Record<string, unknown>) {
  const cleaned: Record<string, unknown> = {};
  if (meta) {
    for (const [k, v] of Object.entries(meta)) {
      if (/key|secret|token|password|authorization|cookie|image|base64/i.test(k)) {
        cleaned[k] = "[redacted]";
      } else {
        cleaned[k] = v;
      }
    }
  }
  console.log(`[${scope}] ${message}`, Object.keys(cleaned).length ? cleaned : "");
}
