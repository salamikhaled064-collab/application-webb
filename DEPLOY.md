# Déploiement GitHub → Render

## 1. Pousser le code sur GitHub

```bash
cd ai-video-saas
git init && git add . && git commit -m "Vidéo IA"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/VOTRE-DEPOT.git
git push -u origin main
```

Ne commitez jamais de fichier `.env`.

## 2. Créer le Blueprint

Render → **New → Blueprint** → choisissez le dépôt → **Apply**.
Render crée : `ai-video-api`, `ai-video-web`, `ai-video-db`.

Il vous demande `ADMIN_BOOTSTRAP_EMAIL` et `ADMIN_BOOTSTRAP_PASSWORD` :
mettez votre e-mail et un mot de passe long (12+ caractères). C'est votre compte **administrateur**,
créé automatiquement au démarrage de l'API — plus besoin du Shell Render.

## 3. Vérifier

```bash
curl https://VOTRE-SITE.onrender.com/api/health
```

Puis ouvrez le site, connectez-vous avec l'e-mail admin : un bouton **Admin** jaune apparaît dans la barre du haut.

> Après le premier démarrage, supprimez `ADMIN_BOOTSTRAP_PASSWORD` dans Render → ai-video-api → Environment.

## 4. Tester sans clé (mode mock)

`/create` → choisir **texte** ou **image** → décrire → régler → générer.
La génération dure ~8 secondes et affiche une vidéo de démonstration.

## 5. Activer les vraies vidéos (Agnes)

1. `/admin` → **Clés API** → ajouter la clé (chiffrée en base).
2. Render → ai-video-api → Environment : `VIDEO_PROVIDER=agnes` → redéployer.

## Limites à connaître

- **Stockage local** : sur Render, le disque est effacé à chaque redéploiement. Les vidéos réelles téléchargées
  disparaissent alors. Pour les conserver : `STORAGE_PROVIDER=s3` + variables `S3_*` (Cloudflare R2 gratuit).
- **Redis optionnel** : sans `REDIS_URL`, la file est en mémoire. Au redémarrage, les générations restées
  « en cours » sont relancées automatiquement.
- **Séparer le worker** (plus de volume) : ajoutez un service `worker` avec `npm run start:worker`,
  `RUN_WORKER_IN_API=false`, `REDIS_URL`, `STORAGE_PROVIDER=s3` et les mêmes `ENCRYPTION_KEY` / `S3_*` que l'API.
