"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, getApiUrl, getNetworkErrorMessage } from "../../../lib/api";
import Link from "next/link";

const API = getApiUrl();

export default function GenerationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [gen, setGen] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/generations/${id}`);
      setGen(data);
      setError("");
    } catch (e: any) {
      if (e.status === 401) {
        router.push("/login");
        return;
      }
      setError(getNetworkErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!gen) return;
    if (["completed", "failed", "cancelled"].includes(gen.status)) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [gen?.status, load]);

  async function cancel() {
    await apiFetch(`/api/generations/${id}/cancel`, { method: "POST" });
    load();
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !gen) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-red-600">{error || "Génération introuvable"}</p>
        <Link href="/history" className="mt-4 inline-block text-sky-600 hover:underline">
          Retour à l&apos;historique
        </Link>
      </div>
    );
  }

  // Always proxy via API – never expose Agnes or external provider URLs
  const videoSrc =
    gen.status === "completed" ? `${API}/api/generations/${id}/video` : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/history" className="text-sm text-sky-600 hover:underline">
            ← Historique
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Génération</h1>
          <p className="font-mono text-xs text-slate-400">{id}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            gen.status === "completed"
              ? "bg-emerald-100 text-emerald-800"
              : gen.status === "failed"
              ? "bg-red-100 text-red-800"
              : gen.status === "cancelled"
              ? "bg-slate-100 text-slate-600"
              : "bg-sky-100 text-sky-800"
          }`}
        >
          {gen.status}
        </span>
      </div>

      {!["completed", "failed", "cancelled"].includes(gen.status) && (
        <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-6 dark:border-sky-900 dark:bg-sky-950/40">
          <div className="mb-2 flex justify-between text-sm">
            <span>Progression</span>
            <span className="font-semibold">{gen.progress ?? 0}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-sky-100 dark:bg-sky-900">
            <div
              className="h-full rounded-full bg-sky-500 transition-all duration-500"
              style={{ width: `${gen.progress ?? 0}%` }}
            />
          </div>
          <button onClick={cancel} className="mt-4 text-sm text-red-600 hover:underline">
            Annuler
          </button>
        </div>
      )}

      {gen.status === "completed" && videoSrc && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-lg dark:border-slate-700">
          <video src={videoSrc} controls className="w-full" playsInline />
          <div className="flex gap-3 bg-slate-900 p-4">
            <a
              href={`${API}/api/generations/${id}/download`}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              Télécharger
            </a>
          </div>
        </div>
      )}

      {gen.status === "failed" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {gen.errorMessage || "Échec de la génération"}
        </div>
      )}

      <div className="mt-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase text-slate-400">Prompt</p>
          <p className="mt-1 text-sm">{gen.prompt}</p>
        </div>
        <div className="space-y-2 text-sm">
          <p><span className="text-slate-400">Format :</span> {gen.format}</p>
          <p><span className="text-slate-400">Style :</span> {gen.style || "—"}</p>
          <p><span className="text-slate-400">Durée :</span> {gen.durationSeconds}s</p>
          <p><span className="text-slate-400">Crédits :</span> {gen.creditsUsed} ({gen.creditStatus})</p>
        </div>
      </div>
    </div>
  );
}
