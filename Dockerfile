# =========================
# Image de base
# =========================
FROM node:20-alpine AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# =========================
# Installation des dépendances
# =========================
FROM base AS deps

COPY package.json package-lock.json* ./

# Copie des fichiers package des workspaces
COPY apps/web/package.json ./apps/web/package.json
COPY packages/video-provider/package.json ./packages/video-provider/package.json

RUN npm install

# =========================
# Compilation de l'application
# =========================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

WORKDIR /app/apps/web

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# =========================
# Image finale de production
# =========================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Dépendances Node, y compris Next.js
COPY --from=builder --chown=nextjs:nodejs \
    /app/node_modules \
    ./node_modules

# Package.json racine et fichiers de verrouillage
COPY --from=builder --chown=nextjs:nodejs \
    /app/package.json \
    ./package.json

COPY --from=builder --chown=nextjs:nodejs \
    /app/package-lock.json* \
    ./

# Application web complète avec .next et public
COPY --from=builder --chown=nextjs:nodejs \
    /app/apps/web \
    ./apps/web

USER nextjs

EXPOSE 3000

# Utilise le script défini dans le package.json racine
CMD ["npm", "run", "start:web"]
