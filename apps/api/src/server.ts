import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config, safeLog } from "./config";
import * as storage from "./services/storage-service";
import { initQueue, closeQueue } from "./queues/generation-queue";
import { prisma } from "./lib/prisma";
import { csrfProtection, issueCsrfToken } from "./middleware/csrf";

import authRoutes from "./routes/auth";
import uploadRoutes from "./routes/uploads";
import generationRoutes from "./routes/generations";
import creditsRoutes from "./routes/credits";
import adminRoutes from "./routes/admin";

storage.ensureStorageDirs();

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
    hsts: config.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
  })
);

app.use(
  cors({
    origin: (origin, cb) => {
      const allowed = [config.webUrl];
      if (!origin || allowed.includes(origin)) return cb(null, true);
      return cb(new Error("CORS not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: config.isProd ? 60 : 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Trop de requêtes, réessayez plus tard" },
  })
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Trop de tentatives d'authentification" },
});

// Health exempt from CSRF
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      provider: config.videoProvider,
      redis: Boolean(config.redisUrl),
      time: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({ status: "degraded", error: "database unavailable" });
  }
});

// CSRF token endpoint
app.get("/api/auth/csrf", (req, res) => {
  const token = issueCsrfToken(req, res);
  res.json({ csrfToken: token });
});

// CSRF on mutating routes
app.use(csrfProtection);

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/generations", generationRoutes);
app.use("/api/credits", creditsRoutes);
app.use("/api/admin", adminRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  safeLog("error", err.message || "unknown");
  if (err.message === "CORS not allowed") {
    return res.status(403).json({ error: "Origine non autorisée" });
  }
  res.status(err.status || 500).json({ error: "Erreur interne" });
});

async function main() {
  await initQueue();

  if (config.runWorkerInApi) {
    const { startWorkerInProcess } = await import("./workers/generation-worker");
    startWorkerInProcess();
    safeLog("api", "In-process worker enabled (dev / no Redis)");
  }

  const server = app.listen(config.port, "0.0.0.0", () => {
    safeLog("api", `Listening on 0.0.0.0:${config.port}`);
    safeLog("api", `Provider=${config.videoProvider} CORS=${config.webUrl}`);
  });

  const shutdown = async (sig: string) => {
    safeLog("api", `${sig} received, shutting down`);
    server.close();
    await closeQueue();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[api] Fatal:", err.message);
  process.exit(1);
});
