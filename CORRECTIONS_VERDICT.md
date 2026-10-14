# Corrections appliquées (verdict archive)

## Corrigé immédiatement

1. **`image?: string`** dans `packages/video-provider/src/types.ts`
2. **Agnes payload** : `image` ajoutée uniquement si présente (jamais `""`)
3. **`/login` et `/register`** utilisent `apiFetch` (plus de `localhost` en prod)
4. **`/history`, `/admin`, `/generations/[id]`, `Header`** : client API centralisé
5. **`lib/api.ts`** : en production, absence de `NEXT_PUBLIC_API_URL` → erreur claire (pas de fallback localhost)
6. **Worker** : fallback `AGNES_API_KEY` env si aucune clé en base
7. **Tests** : validation mode A/B (vitest)

## Variables Render obligatoires

```
# Frontend (rebuild requis après changement)
NEXT_PUBLIC_API_URL=https://TON-API.onrender.com

# API + Worker
WEB_URL=https://TON-FRONTEND.onrender.com
VIDEO_PROVIDER=mock
STORAGE_PROVIDER=s3
S3_ENDPOINT=...
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
ENCRYPTION_KEY=<identique API et worker>
REDIS_URL=<from Redis>
DATABASE_URL=<from Postgres>

# Optionnel Agnes
VIDEO_PROVIDER=agnes
AGNES_API_KEY=...   # ou clé via /admin
```

## Testé dans cet environnement

| Action | Résultat |
|--------|----------|
| Inspection code | OK |
| Corrections listées | Appliquées |
| `npm install` complet | Timeout réseau – non finalisé ici |
| Typecheck / build | Non exécuté (dépendances absentes) |
| Render / Postgres / Redis / R2 | Non testables sans vos credentials |

## Mock vs Agnes

| Fonctionnalité | Mock | Agnes |
|----------------|------|-------|
| Auth / CSRF / crédits | Oui | Oui |
| PROMPT_ONLY | Oui | Oui (sans champ image) |
| IMAGE_TO_VIDEO | Oui | Oui (avec image) |
| Vidéo réelle | Démo | Clé + format API confirmé requis |

## Après déploiement

1. Configurer `NEXT_PUBLIC_API_URL` + redeploy **web**
2. `curl https://API/health` → `{"status":"ok"}`
3. Inscription → login → mode prompt mock
4. Admin : `npm run admin:create` puis supprimer les env bootstrap
