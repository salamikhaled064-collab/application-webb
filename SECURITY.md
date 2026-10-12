# Sécurité – AI Video SaaS

## Mesures en place

| Domaine | Mesure |
|---------|--------|
| Mots de passe | Argon2id (argon2) |
| Sessions | Cookie `HttpOnly`, `Secure` + `SameSite=None` en prod |
| Secrets prod | Rejet au démarrage si faibles / défauts |
| CORS | Origine explicite (`WEB_URL` uniquement) |
| Rate limit | Global + auth (20/15min) + upload (10/min) |
| Upload | Magic bytes (JPEG/PNG/WebP), pas seulement `Content-Type` |
| Path traversal | Clés stockage normalisées + vérification sous `STORAGE_DIR` |
| Validation | Zod sur les entrées API |
| Headers | Helmet + HSTS en production |
| Logs | `safeLog` redacte key/secret/token/password/base64 |
| Clés Agnes | AES-256-GCM en base, jamais renvoyées au client |
| Crédits | Transactions Prisma + idempotence (reserved/charged/refunded) |
| Téléchargement | Routes auth `/api/generations/:id/video\|download` |
| Worker | Séparé en production (`RUN_WORKER_IN_API=false`) |
| Queue | BullMQ + jobId = generationId (idempotence) |
| Admin | Middleware `role === admin` côté serveur |

## Interdit

- Clé API dans le frontend ou Git
- URL Agnes exposée comme source principale côté client
- SQLite en production Render
- Secrets par défaut en production

## Agnes – incertitudes (à confirmer officiellement)

- Format exact image (base64 vs URL publique vs multipart)
- Nom exact des champs (prompt, num_frames, frame_rate)
- Endpoint de statut réel et valeurs de statut
- Durée de validité des URLs vidéo
- Structure des erreurs 429

Tant que non confirmé : garder `VIDEO_PROVIDER=mock`.
