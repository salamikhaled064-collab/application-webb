# Corrections suite au verdict (75–80 % → ~85 %)

## Déjà corrigés dans cette archive

| Priorité | Point verdict | Correction |
|----------|---------------|------------|
| 1 | Admin non monté | `app.use("/api/admin", adminRoutes)` |
| 9 | Pas de page /admin | `apps/web/src/app/admin/page.tsx` |
| 10 | Pas de CSRF | middleware + `/api/auth/csrf` |
| 3 | Crédits ambigus | `charge` → `confirmation` amount=0 |
| 2 | Retries BullMQ | `TemporaryError` rethrow vs permanent fail+refund |
| 7 | Worker sans provider | utilise `AgnesVideoProvider` / `MockVideoProvider` |
| 6 | Vidéo non stockée | `downloadVideoToStorage` (stream disque) |
| 8 | Scripts manquants | typecheck / lint / test / db:migrate |

## Toujours non finalisé (honnête)

| Point | Pourquoi |
|-------|----------|
| Stockage S3/R2 partagé | Structure prête ; pas de SDK AWS complet sans credentials |
| Migrations Prisma riches | Stub + `db push` en Render pour le premier deploy |
| Format exact Agnes | Doc non confirmée |
| Tests e2e automatisés | Squelettes unitaires seulement |
| Disque Render API↔worker | Sans objet storage, fichiers non partagés entre services |

## Premier deploy Render

```env
VIDEO_PROVIDER=mock
RUN_WORKER_IN_API=false
```
