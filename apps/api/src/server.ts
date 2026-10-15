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
import { bootstrapAdmin } from "./lib/bootstrap-admin";

import authRoutes from "./routes/auth";
import uploadRoutes from "./routes/uploads";
import generationRoutes from "./routes/generations";
import creditsRoutes from "./routes/credits";
import adminRoutes from "./routes/admin";

storage.ensureStorageDirs();

const app = express();

// Derrière Render / le proxy Next : sans ça, req.ip = IP du proxy pour TOUS les
// utilisateurs et le rate-limit global les bloque tous ensemble.
app.set("trust proxy", config.trustProxy);

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
      if (!origin || config.allowedOrigins.includes(origin.replace(/\/+$/, ""))) {
        return cb(null, true);
      }
      return cb(new Error("CORS not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
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
  max: 30,
  skipSuccessfulRequests: true, // seules les tentatives échouées comptent
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives, réessayez dans quelques minutes" },
});

// Health exempt from CSRF
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

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

// Route API inconnue → JSON propre (et non une page HTML)
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Route introuvable" });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  safeLog("error", err?.message || "unknown");
  if (err?.message === "CORS not allowed") {
    return res.status(403).json({ error: "Origine non autorisée" });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Requête trop volumineuse" });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "JSON invalide" });
  }
  if (err?.name === "ZodError") {
    return res.status(400).json({ error: err.errors?.[0]?.message || "Données invalides" });
  }
  if (err?.code === "P2025") {
    return res.status(404).json({ error: "Élément introuvable" });
  }
  const status = Number(err?.status) || 500;
  // Les erreurs 4xx portent un message destiné à l'utilisateur ; les 5xx restent génériques.
  res.status(status).json({ error: status < 500 && err?.message ? err.message : "Erreur interne" });
});

// Une promesse rejetée ne doit JAMAIS faire tomber l'API : on journalise et on continue.
process.on("unhandledRejection", (reason: any) => {
  console.error("[api] unhandledRejection:", reason?.message || reason);
});
process.on("uncaughtException", (err) => {
  console.error("[api] uncaughtException:", err?.message || err);
});

async function main() {
  // On écoute d'abord : le healthcheck Render passe tout de suite, même si Redis est lent.
  const server = app.listen(config.port, "0.0.0.0", () => {
    safeLog("api", `Listening on 0.0.0.0:${config.port}`);
    safeLog("api", `Provider=${config.videoProvider} origins=${config.allowedOrigins.join(",")}`);
  });

  await initQueue();

  try {
    await bootstrapAdmin();
  } catch (e: any) {
    safeLog("admin", `bootstrap échoué: ${e?.message}`);
  }

  if (config.runWorkerInApi) {
    const { startWorkerInProcess } = await import("./workers/generation-worker");
    await startWorkerInProcess();
    safeLog("api", "In-process worker enabled");
  }

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
