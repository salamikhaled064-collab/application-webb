# Corriger « Failed to fetch » sur Render

## Cause principale

`NEXT_PUBLIC_API_URL` est **injectée au build** du frontend. Si elle pointe vers `localhost` ou est vide, le navigateur ne peut pas joindre l’API.

## Correction

1. Service **ai-video-web** sur Render → Environment :
   ```
   NEXT_PUBLIC_API_URL=https://VOTRE-API.onrender.com
   ```
   (sans slash final)

2. Service **ai-video-api** :
   ```
   WEB_URL=https://VOTRE-FRONTEND.onrender.com
   ```

3. **Redeploy manuel** du frontend (Clear build cache recommandé).

4. Vérifier :
   ```bash
   curl https://VOTRE-API.onrender.com/health
   curl https://VOTRE-API.onrender.com/api/health
   ```

## Modes

| Mode | Clé API | Description |
|------|---------|-------------|
| `VIDEO_PROVIDER=mock` | Non | Tests UI, crédits, file d’attente |
| `VIDEO_PROVIDER=agnes` | Oui (backend only) | Vraies vidéos |

La clé Agnes ne va **jamais** dans `NEXT_PUBLIC_*`.
