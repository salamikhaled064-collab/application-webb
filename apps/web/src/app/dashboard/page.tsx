"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getNetworkErrorMessage } from "../../lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ credits?: number; email?: string } | null>(null);
  const [stats, setStats] = useState({ completed: 0, processing: 0, failed: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await apiFetch<{ user: any }>("/api/auth/me");
        setUser(me.user);
        const data = await apiFetch<{ generations: any[] }>("/api/generations");
        const gens = data.generations || [];
        setRecent(gens.slice(0, 5));
        setStats({
          completed: gens.filter((g) => g.status === "completed").length,
          processing: gens.filter((g) =>
            ["pending", "queued", "processing"].includes(g.status)
          ).length,
          failed: gens.filter((g) => g.status === "failed").length,
        });
      } catch (e: any) {
        if (e.status === 401) {
          router.push("/login");
          return;
        }
        setError(getNetworkErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
        Chargement…
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#f7f6f3] dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tableau de bord</h1>
            <p className="mt-1 text-sm text-slate-500">
              {user?.email ? `Connecté : ${user.email}` : "Bienvenue"}
            </p>
          </div>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900"
          >
            + Nouvelle vidéo
          </Link>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Crédits restants", value: String(user?.credits ?? "—"), color: "text-violet-600" },
            { label: "Terminées", value: String(stats.completed), color: "text-emerald-600" },
            { label: "En cours", value: String(stats.processing), color: "text-amber-600" },
            { label: "Échouées", value: String(stats.failed), color: "text-red-500" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{s.label}</p>
              <p className={`mt-2 text-3xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Dernières vidéos</h2>
            <Link href="/history" className="text-sm font-medium text-violet-600 hover:underline">
              Voir tout →
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="mt-6 flex flex-col items-center py-12 text-center">
              <p className="text-sm text-slate-500">Aucune génération pour le moment.</p>
              <Link href="/create" className="mt-3 text-sm font-semibold text-violet-600 hover:underline">
                Créer votre première vidéo
              </Link>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {recent.map((g) => (
                <li key={g.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                      {g.prompt?.slice(0, 80)}
                      {(g.prompt?.length || 0) > 80 ? "…" : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {g.mode || "IMAGE_TO_VIDEO"} · {g.format} · {g.durationSeconds}s · {g.status}
                    </p>
                  </div>
                  <Link
                    href={`/generations/${g.id}`}
                    className="ml-4 shrink-0 text-sm font-medium text-violet-600 hover:underline"
                  >
                    Voir
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
