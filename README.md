# AI Video SaaS v1.4

## Corrections de cette version

1. **R2/S3 obligatoire sur Render** (`STORAGE_PROVIDER=s3` dans render.yaml)
2. **Package `@ai-video/video-provider` compilé** en JS avant API/worker
3. **Frontend** : vidéo uniquement via `/api/generations/:id/video`
4. **Fail-fast** si `STORAGE_PROVIDER=s3` sans credentials
5. **`npm run admin:create`** – bootstrap admin sécurisé (Argon2id, idempotent)

## Commandes

```bash
npm install
npx prisma generate
npx prisma migrate deploy

# Local (un process)
RUN_WORKER_IN_API=true STORAGE_PROVIDER=local npm run dev:api
npm run dev

# Admin
ADMIN_BOOTSTRAP_EMAIL=... ADMIN_BOOTSTRAP_PASSWORD=... npm run admin:create
```

## Déploiement

Voir **[DEPLOY.md](./DEPLOY.md)** — guide GitHub → Render complet.
