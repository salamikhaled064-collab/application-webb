"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getNetworkErrorMessage } from "../../lib/api";
import { Alert, MODE_LABEL, Spinner, StatusBadge } from "../../components/ui";

const FILTERS = [
  { id: "all", label: "Toutes" },
  { id: "PROMPT_ONLY", label: "Texte → vidéo" },
  { id: "IMAGE_TO_VIDEO", label: "Image → vidéo" },
  { id: "processing", label: "En cours" },
  { id: "completed", label: "Terminées" },
  { id: "failed", label: "Échouées" },
];

export default function HistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  async function load() {
    try {
      const data = await apiFetch<{ generations: any[] }>("/api/generations");
      setItems(data.generations || []);
      setError("");
    } catch (e: any) {
      if (e?.status === 401) return router.push("/login");
      setError(getNetworkErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (!confirm("Supprimer cette vidéo définitivement ?")) return;
    try {
      await apiFetch(`/api/generations/${id}`, { method: "DELETE" });
      setItems((list) => list.filter((g) => g.id !== id));
    } catch (e) {
      setError(getNetworkErrorMessage(e));
    }
  }

  const shown = items.filter((g) => {
    if (filter === "all") return true;
    if (filter === "processing") return ["pending", "queued", "processing"].includes(g.status);
    if (filter === "completed" || filter === "failed") return g.status === filter;
    return (g.mode || "IMAGE_TO_VIDEO") === filter;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Historique</h1>
          <p className="mt-1 text-sm text-muted">{items.length} génération{items.length > 1 ? "s" : ""}</p>
        </div>
        <Link href="/create" className="btn-primary">Nouvelle vidéo</Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="mt-5"><Alert>{error}</Alert></div>}

      {loading ? (
        <div className="mt-16 flex justify-center"><Spinner /></div>
      ) : shown.length === 0 ? (
        <div className="card mt-8 px-6 py-16 text-center">
          <p className="font-display text-xl font-bold">{items.length === 0 ? "Aucune vidéo pour le moment" : "Aucun résultat pour ce filtre"}</p>
          {items.length === 0 && (
            <>
              <p className="mt-1 text-sm text-muted">Créez votre première vidéo en moins d&apos;une minute.</p>
              <Link href="/create" className="btn-primary mt-5">Créer une vidéo</Link>
            </>
          )}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((g) => (
            <div key={g.id} className="card flex flex-col p-5 transition-colors hover:border-brand/50">
              <div className="flex items-center justify-between">
                <StatusBadge status={g.status} />
                <span className="text-xs text-muted">{new Date(g.createdAt).toLocaleDateString("fr-FR")}</span>
              </div>
              <Link href={`/generations/${g.id}`} className="mt-3 line-clamp-3 flex-1 text-sm font-medium leading-relaxed hover:text-brand">
                {g.prompt}
              </Link>
              <p className="mt-3 text-xs text-muted">
                {MODE_LABEL[g.mode] || g.mode} · {g.format} · {g.durationSeconds} s
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <Link href={`/generations/${g.id}`} className="text-sm font-semibold text-brand hover:underline">Ouvrir</Link>
                <button onClick={() => remove(g.id)} className="text-sm text-muted hover:text-bad">Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
