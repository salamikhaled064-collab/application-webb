# Déploiement GitHub → Render (étape par étape)

## Prérequis

1. Compte [GitHub](https://github.com)
2. Compte [Render](https://render.com)
3. Compte [Cloudflare](https://dash.cloudflare.com) (R2 gratuit recommandé) **ou** AWS S3 / Backblaze B2

Sans stockage objet partagé, l’API et le worker Render **ne voient pas les mêmes fichiers** et le flux échoue.

---

## Étape 1 — Préparer Cloudflare R2 (recommandé)

1. Cloudflare Dashboard → **R2** → Create bucket : `ai-video-storage`
2. **Manage R2 API Tokens** → Create API token  
   - Permissions : Object Read & Write  
   - Copier : Access Key ID + Secret Access Key
3. Noter l’endpoint :  
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

---

## Étape 2 — Pousser le code sur GitHub

```bash
# Depuis le dossier du projet dézippé
cd ai-video-saas

# Vérifier qu’aucun secret n’est dans .env
cp .env.example .env
# édite .env en local uniquement – ne le commit JAMAIS

echo ".env" >> .gitignore
echo "node_modules/" >> .gitignore
echo "storage/" >> .gitignore
echo "dist/" >> .gitignore
echo ".next/" >> .gitignore

git init
git add .
git commit -m "AI Video SaaS – ready for Render"

# Créer un repo vide sur GitHub, puis :
git branch -M main
git remote add origin https://github.com/TON-USER/TON-REPO.git
git push -u origin main
```

---

## Étape 3 — Créer le Blueprint Render

1. Render Dashboard → **New** → **Blueprint**
2. Connecter le repo GitHub
3. Render lit `render.yaml` et propose :
   - `ai-video-web` (frontend)
   - `ai-video-api` (API)
   - `ai-video-worker` (worker)
   - `ai-video-redis` (Redis)
   - `ai-video-db` (PostgreSQL)
4. **Apply**

---

## Étape 4 — Variables d’environnement

### Service `ai-video-api`

| Variable | Valeur |
|----------|--------|
| `WEB_URL` | `https://ai-video-web-XXXX.onrender.com` (URL frontend après 1er deploy) |
| `SESSION_SECRET` | généré auto ou `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | **même valeur** que le worker (`openssl rand -hex 32`) |
| `VIDEO_PROVIDER` | `mock` |
| `STORAGE_PROVIDER` | `s3` |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_BUCKET` | `ai-video-storage` |
| `S3_ACCESS_KEY_ID` | (token R2) |
| `S3_SECRET_ACCESS_KEY` | (secret R2) |

### Service `ai-video-worker`

Mêmes valeurs pour :

- `ENCRYPTION_KEY` (identique à l’API)
- `STORAGE_PROVIDER=s3`
- `S3_*` (identiques à l’API)
- `VIDEO_PROVIDER=mock`

### Service `ai-video-web`

| Variable | Valeur |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://ai-video-api-XXXX.onrender.com` |

> Après le premier déploiement, mets à jour `WEB_URL` et `NEXT_PUBLIC_API_URL` avec les vraies URLs, puis **Manual Deploy**.

---

## Étape 5 — Vérifier le healthcheck

```bash
curl https://ai-video-api-XXXX.onrender.com/api/health
```

Réponse attendue :

```json
{ "status": "ok", "provider": "mock", "redis": true }
```

---

## Étape 6 — Créer le compte administrateur

**Temporairement** sur le service API, ajoute :

```
ADMIN_BOOTSTRAP_EMAIL=ton-email@exemple.com
ADMIN_BOOTSTRAP_PASSWORD=MotDePasseTemporaireLong12
```

Puis dans le **Shell** Render du service API :

```bash
npm run admin:create
```

Sortie attendue :

```
Compte administrateur configuré avec succès.
```

**Supprime immédiatement** `ADMIN_BOOTSTRAP_EMAIL` et `ADMIN_BOOTSTRAP_PASSWORD` du dashboard Render.

Connecte-toi sur :

```
https://ai-video-web-XXXX.onrender.com/login
```

Puis ouvre `/admin`.

---

## Étape 7 — Test Mock de bout en bout

1. Inscription / connexion
2. `/create` → upload image → prompt → générer
3. Redirection vers `/generations/:id` (suivi)
4. Attendre `completed`
5. Lire la vidéo via `/api/generations/:id/video` (proxifiée)
6. Vérifier l’historique

---

## Étape 8 — (Plus tard) Activer Agnes

1. Confirmer le format API avec la doc Agnes
2. `/admin` → ajouter une clé (stockée chiffrée)
3. Sur API + worker : `VIDEO_PROVIDER=agnes`
4. Redeploy

---

## Alternative sans R2 (déconseillé, dev seulement)

Un seul service API avec worker in-process :

```
RUN_WORKER_IN_API=true
STORAGE_PROVIDER=local
```

et **ne pas** déployer le worker séparé. Les fichiers restent sur le même disque éphémère (perdus au redémarrage).

---

## Checklist sécurité

- [ ] Aucun `.env` dans Git
- [ ] `ENCRYPTION_KEY` identique API + worker
- [ ] Bootstrap admin variables **supprimées** après usage
- [ ] Mot de passe admin changé si partagé ailleurs
- [ ] CORS = uniquement `WEB_URL`
- [ ] Cookies `Secure` + `SameSite=none` en production


## Point critique — ENCRYPTION_KEY

`ENCRYPTION_KEY` doit être **exactement la même valeur** sur les services **API** et **worker**.

Render ne partage pas automatiquement cette variable entre services.

```bash
openssl rand -hex 32
```

Copiez le résultat dans :
- ai-video-api → Environment → ENCRYPTION_KEY
- ai-video-worker → Environment → ENCRYPTION_KEY

Sans cela, le worker ne pourra pas déchiffrer les clés Agnes stockées par l'API.
