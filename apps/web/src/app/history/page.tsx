"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function HistoryPage() {
  const router = useRouter();
  const [generations, setGenerations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/api/generations`, { credentials: "include" });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        setGenerations(data.generations || []);
      } catch {
        setGenerations([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const filtered =
    filter === "all"
      ? generations
      : generations.filter((g) =>
          filter === "completed"
            ? g.status === "completed"
            : filter === "processing"
            ? ["pending", "queued", "processing"].includes(g.status)
            : g.status === "failed"
        );

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Historique</h1>
            <p className="mt-1 text-sm text-slate-500">Toutes vos générations</p>
          </div>
          <div className="flex gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="all">Tous les statuts</option>
              <option value="completed">Terminées</option>
              <option value="processing">En cours</option>
              <option value="failed">Échouées</option>
            </select>
            <Link
              href="/create"
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              + Nouvelle
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="mt-16 flex justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl dark:bg-slate-800">
                📁
              </div>
              <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                Aucune génération
              </p>
              <Link href="/create" className="mt-4 text-sm text-sky-600 hover:underline">
                Créer votre première vidéo
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((g) => (
              <Link
                key={g.id}
                href={`/generations/${g.id}`}
                className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      g.status === "completed"
                        ? "bg-emerald-100 text-emerald-700"
                        : g.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-sky-100 text-sky-700"
                    }`}
                  >
                    {g.status}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(g.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-700 dark:text-slate-300">
                  {g.prompt}
                </p>
                <div className="mt-3 flex gap-3 text-xs text-slate-400">
                  <span>{g.format}</span>
                  <span>{g.durationSeconds}s</span>
                  <span>{g.creditsUsed} crédits</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
