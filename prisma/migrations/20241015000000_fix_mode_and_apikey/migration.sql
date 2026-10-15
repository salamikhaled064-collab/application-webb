-- Colonne "mode" utilisée par le code mais absente de la migration initiale
-- (provoquait une erreur 500 à CHAQUE création de génération).
ALTER TABLE "video_generations"
  ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'IMAGE_TO_VIDEO';

-- "updatedAt" n'existe pas dans le schéma Prisma d'ApiKey : sans valeur par défaut,
-- l'ajout d'une clé API depuis /admin échouait (NOT NULL violation).
ALTER TABLE "api_keys" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");
