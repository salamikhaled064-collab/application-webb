# =========================
# Base
# =========================
FROM node:20-alpine AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# =========================
# Installation des dépendances
# =========================
FROM base AS deps

COPY package.json package-lock.json* ./

# Copie des manifests des workspaces
COPY apps/web/package.json ./apps/web/package.json
COPY packages/video-provider/package.json ./packages/video-provider/package.json

RUN npm install

# =========================
# Compilation de Next.js
# =========================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

WORKDIR /app/apps/web

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# =========================
# Image de production
# =========================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Le serveur standalone Next.js
COPY --from=builder --chown=nextjs:nodejs \
    /app/apps/web/.next/standalone/ ./

# Les fichiers statiques Next.js
COPY --from=builder --chown=nextjs:nodejs \
    /app/apps/web/.next/static \
    ./apps/web/.next/static

# Le dossier public
COPY --from=builder --chown=nextjs:nodejs \
    /app/apps/web/public \
    ./apps/web/public

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
