# Rapport final — ai-video-saas (prompt 18 pages)

## Résumé des corrections

| Priorité | Statut |
|----------|--------|
| apps/web présent | ✅ |
| Appels API via `apiFetch` uniquement | ✅ |
| Pas de fallback localhost en production | ✅ |
| Mode PROMPT_ONLY sans image | ✅ |
| Payload Agnes sans `image: ""` | ✅ |
| Fallback `AGNES_API_KEY` | ✅ |
| Redis obligatoire en production | ✅ |
| Même ENCRYPTION_KEY API+worker (doc + render.yaml sync:false) | ✅ |
| Prisma + migrations | ✅ (présentes) |
| S3/R2 API + worker | ✅ (structure) |
| Tests exécutables (mode A/B + payload Agnes) | ✅ partiel |
| Auth + CSRF + cookies | ✅ |
| Crédits idempotents | ✅ |
| Admin protégé API | ✅ |
| Dashboard branché sur l’API | ✅ |
| Filtres historique (modes + statuts) | ✅ |

## Fichiers modifiés (cette passe)

- `apps/api/src/config.ts` — Redis obligatoire en prod
- `render.yaml` — ENCRYPTION_KEY sync:false (même valeur manuelle)
- `apps/web/src/app/dashboard/page.tsx` — données réelles via apiFetch
- `apps/web/src/app/history/page.tsx` — filtres modes + statuts
- `packages/video-provider/src/agnes-payload.test.ts` — test payload
- `DEPLOY.md` — note ENCRYPTION_KEY
- `RAPPORT_FINAL.md` — ce rapport

## Déjà en place (passes précédentes)

- `apps/web/src/lib/api.ts` — client centralisé
- login / register / create / admin / Header / generations — apiFetch
- `types.ts` — `image?: string`
- `agnes.ts` — image conditionnelle
- worker — mode PROMPT_ONLY + AGNES_API_KEY fallback
- generation-service — dual mode
- scripts/create-admin.ts

## Ce qui n’a PAS pu être testé ici

| Action | Raison |
|--------|--------|
| `npm install` complet | Timeout réseau sandbox (en cours ou échoué) |
| `npm run typecheck` / `build` / `lint` | Dépend de node_modules |
| PostgreSQL / Redis / R2 live | Pas d’accès à votre Render |
| Agnes API réelle | Pas de clé ni confirmation du format |

**Ne pas considérer le projet comme « 100 % validé en production »** tant que les commandes ci-dessous n’ont pas réussi **chez vous**.

## Variables Render obligatoires

| Service | Variable | Note |
|---------|----------|------|
| web | `NEXT_PUBLIC_API_URL` | URL API **sans** slash final → **rebuild web** |
| api | `WEB_URL` | URL frontend exacte |
| api + worker | `DATABASE_URL` | from Postgres |
| api + worker | `REDIS_URL` | from Redis |
| api | `SESSION_SECRET` | fort |
| api + worker | `ENCRYPTION_KEY` | **identique** (`openssl rand -hex 32`) |
| api + worker | `VIDEO_PROVIDER` | `mock` d’abord |
| api + worker | `STORAGE_PROVIDER` | `s3` |
| api + worker | `S3_*` | **identiques** |
| api/worker | `AGNES_API_KEY` | seulement si Agnes |

## Instructions déploiement

1. Push GitHub → Blueprint Render (`render.yaml`)
2. Renseigner S3/R2 + `WEB_URL` + `NEXT_PUBLIC_API_URL`
3. Copier **la même** `ENCRYPTION_KEY` sur API et worker
4. Deploy → `curl https://API/health` et `/api/health`
5. Shell API : `ADMIN_BOOTSTRAP_EMAIL=... ADMIN_BOOTSTRAP_PASSWORD=... npm run admin:create`
6. Supprimer les variables bootstrap
7. Tester Mock mode A puis mode B
8. Ensuite seulement `VIDEO_PROVIDER=agnes`

## Test mode A (Mock)

1. Inscription / login
2. `/create` → « Générer avec un prompt »
3. Prompt ≥ 10 caractères, format, durée
4. Générer → `/generations/:id` → completed
5. Historique + lecture vidéo

## Test mode B (Mock)

1. « Animer une image »
2. Upload JPEG/PNG/WebP ≤ 10 Mo
3. Prompt + générer → completed

## Problèmes restants (non bloquants code)

| Problème | Cause | Impact | Action |
|----------|-------|--------|--------|
| Builds non exécutés ici | Sandbox réseau | Inconnu | Lancer `npm run build` localement |
| Agnes non prouvé | Pas d’appel réel | Production vidéo | Tester avec vraie clé |
| Mock vidéo externe | URL Google sample | Peut échouer si bloquée | Optionnel : stocker une MP4 de test sur R2 |

## Commandes à lancer chez vous

```bash
npm install
npx prisma generate
npm run typecheck
npm run test
npm run build:web
npm run build:api
```
