-- Dernier message d'erreur par clé API (désactivation / pause automatique)
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "lastError" TEXT;
