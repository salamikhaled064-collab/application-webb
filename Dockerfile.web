# Site web (Next.js) — c'est ce Dockerfile qu'utilise le service "application-webb".
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY . .
RUN npm install --include=dev
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=1
RUN npm run build --workspace=apps/web

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
EXPOSE 3000
# API_URL (adresse de l'API) est lue ICI, au démarrage : pas besoin de rebuild pour la changer.
CMD ["node", "apps/web/server.js"]
