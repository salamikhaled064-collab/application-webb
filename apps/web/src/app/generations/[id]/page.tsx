"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, apiUrl, getNetworkErrorMessage, notifyAuthChanged } from "../../../lib/api";
import { Alert, MODE_LABEL, Spinner, StatusBadge, ViewFinder } from "../../../components/ui";

const FINAL = ["completed", "failed", "cancelled"];
const MAX_W: Record<string, string> = {
  "9:16": "max-w-[320px]",
  "4:5": "max-w-[420px]",
  "1:1": "max-w-[520px]",
  "16:9": "max-w-full",
};

export default function GenerationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [gen, setGen] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);
  const failures = useRef(0);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/generations/${id}`);
      failures.current = 0;
      setGen(data);
      setError("");
      if (FINAL.includes(data.status)) notifyAuthChanged(); // crédits mis à jour (remboursement éventuel)
    } catch (e: any) {
      if (e?.status === 401) return router.push("/login");
      failures.current += 1;
      // Un raté passager pendant le suivi ne doit pas effacer la page
      setGen((g: any) => {
        if (!g || failures.current >= 3) setError(getNetworkErrorMessage(e));
        return g;
      });
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const status = gen?.status;
  useEffect(() => {
    if (!status || FINAL.includes(status)) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [status, load]);

  async function cancel() {
    try {
      await apiFetch(`/api/generations/${id}/cancel`, { method: "POST" });
      await load();
    } catch (e) {
      setError(getNetworkErrorMessage(e));
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!gen) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Alert>{error || "Génération introuvable."}</Alert>
        <Link href="/history" className="btn-secondary mt-5">Retour à l&apos;historique</Link>
      </div>
    );
  }

  const active = !FINAL.includes(gen.status);
  const src = apiUrl(`/api/generations/${id}/video`);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <Link href="/history" className="text-sm font-semibold text-brand hover:underline">← Historique</Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Votre vidéo</h1>
        <StatusBadge status={gen.status} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className={`mx-auto w-full ${MAX_W[gen.format] ?? "max-w-full"}`}>
          <ViewFinder ratio={gen.format} rec={active}>
            {gen.status === "completed" && !videoFailed && (
              <video
                src={src}
                controls
                playsInline
                autoPlay
                muted
                loop
                onError={() => setVideoFailed(true)}
                className="absolute inset-0 h-full w-full bg-black object-contain"
              />
            )}
            {active && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
                <p className="font-display text-5xl font-bold tabular-nums">{gen.progress ?? 0}%</p>
                <div className="h-2 w-full max-w-[220px] overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${gen.progress ?? 0}%` }} />
                </div>
                <p className="text-sm text-muted">
                  {gen.status === "processing" ? "L'IA crée votre vidéo…" : "En file d'attente…"}
                </p>
              </div>
            )}
            {gen.status === "failed" && <p className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-muted">Aucune vidéo générée.</p>}
            {gen.status === "cancelled" && <p className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-muted">Génération annulée.</p>}
            {gen.status === "completed" && videoFailed && (
              <p className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-muted">
                La vidéo n&apos;est plus disponible. Elle a peut-être expiré après un redémarrage du serveur.
              </p>
            )}
          </ViewFinder>

          {gen.status === "completed" && !videoFailed && (
            <a href={apiUrl(`/api/generations/${id}/download`)} download className="btn-primary mt-4 w-full">
              Télécharger la vidéo
            </a>
          )}
          {active && (
            <button onClick={cancel} className="btn-ghost mt-3 w-full text-bad">
              Annuler la génération
            </button>
          )}
        </div>

        <aside className="space-y-4">
          {gen.status === "failed" && (
            <Alert>
              {gen.errorMessage || "La génération a échoué."}
              {gen.creditStatus === "refunded" && " Vos crédits ont été remboursés."}
            </Alert>
          )}
          {error && <Alert tone="warn">{error}</Alert>}

          <div className="card p-5 text-sm">
            <p className="text-muted">Description</p>
            <p className="mt-1 font-medium leading-relaxed">{gen.prompt}</p>
            <dl className="mt-4 divide-y divide-line">
              {[
                ["Mode", MODE_LABEL[gen.mode] || gen.mode],
                ["Format", gen.format],
                ["Durée", `${gen.durationSeconds} s`],
                ["Style", gen.style && gen.style !== "none" ? gen.style : "Aucun"],
                ["Crédits", `${gen.creditsUsed}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <Link href="/create" className="btn-secondary w-full">Créer une autre vidéo</Link>
        </aside>
      </div>
    </div>
  );
}
