# « Failed to fetch » — causes et corrections

## Ce qui causait l'erreur (toutes corrigées dans cette version)

| # | Cause | Correction |
|---|-------|-----------|
| 1 | Le navigateur appelait l'API sur **un autre domaine** `*.onrender.com`. Opera, Brave, Safari et Chrome bloquent les cookies tiers → connexion/inscription impossibles | Le site relaie maintenant `/api/*` vers l'API (`apps/web/src/app/api/[...path]/route.ts`). Tout est sur **le même domaine** |
| 2 | `NEXT_PUBLIC_API_URL` était figée **au build** : vide ou fausse = tout casse jusqu'au prochain rebuild | Remplacée par `API_URL`, lue **au démarrage** |
| 3 | `npm run build:api` échouait (tests compilés par `tsc`) → l'API n'était jamais en ligne | `src/__tests__` exclu du build |
| 4 | `NODE_ENV=production` + `npm install` ignorait TypeScript/Tailwind → build raté | `npm install --include=dev` |
| 5 | Une erreur dans une route admin (promesse non gérée) **faisait planter** l'API | Wrapper `ah()` + filets `unhandledRejection` |
| 6 | La migration SQL n'avait pas la colonne `mode` → **chaque génération** renvoyait une erreur 500 | Nouvelle migration `20241015000000_fix_mode_and_apikey` |
| 7 | Ajouter une clé API depuis /admin échouait (`updatedAt` NOT NULL) | Même migration |
| 8 | Derrière Render, tous les visiteurs partageaient la même IP → rate-limit commun | `trust proxy` + IP réelle transmise |
| 9 | La vidéo (`<video>`) était demandée sans cookie → 401 | Même domaine = cookie envoyé |

## Vérifier que tout est en ligne

```bash
curl https://VOTRE-SITE.onrender.com/api/health
# attendu : {"status":"ok","provider":"mock",...}
```

- Réponse `502` « Impossible de joindre l'API » → l'API est arrêtée ou `API_URL` est fausse (Render → ai-video-api → Logs).
- Réponse `503` « API_URL est manquante » → ajoutez `API_URL` sur le service **ai-video-web**.
- Sur Render, `API_URL` peut aussi être l'adresse publique de l'API (`https://ai-video-api-xxxx.onrender.com`).
- `NEXT_PUBLIC_API_URL` (ancien nom) est encore lue comme valeur de secours.
