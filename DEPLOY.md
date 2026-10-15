# Déploiement sur Render (Docker) — guide simple

Il faut **3 choses** sur Render : une base de données, l'API, et le site.

## 1. Base de données
New → PostgreSQL → nom `application-db`, plan Free → Create.
Copier l'**Internal Database URL**.

## 2. API (nouveau service)
New → Web Service → même dépôt GitHub.
- Language : Docker
- Dockerfile Path : `./Dockerfile.api`
- Variables : NODE_ENV=production, DATABASE_URL (étape 1), SESSION_SECRET (40 caractères),
  ENCRYPTION_KEY (40 caractères), VIDEO_PROVIDER=mock, RUN_WORKER_IN_API=true,
  STORAGE_PROVIDER=local, ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD (12+ caractères)
Copier le lien du service quand il est "Live".

## 3. Site (service existant `application-webb`)
Environment → ajouter `API_URL` = lien de l'API (sans "/" à la fin) → Save, rebuild and deploy.

## 4. Test
`https://VOTRE-SITE.onrender.com/api/health` doit afficher "status":"ok".
Connexion avec l'e-mail admin → bouton jaune "Admin" en haut.

## Notes
- Plan Free : mise en veille après 15 min, premier chargement lent (~50 s).
- Disque effacé à chaque redémarrage : vidéos réelles non conservées (voir README pour S3/R2).
- Ensuite, supprimer ADMIN_BOOTSTRAP_PASSWORD des variables.
