"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getNetworkErrorMessage } from "../../lib/api";
import { Alert, IconShield, MODE_LABEL, Spinner, StatusBadge } from "../../components/ui";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ credits?: number; email?: string; name?: string | null; role?: string } | null>(null);
  const [gens, setGens] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await apiFetch<{ user: any }>("/api/auth/me");
        setUser(me.user);
        const data = await apiFetch<{ generations: any[] }>("/api/generations");
        setGens(data.generations || []);
      } catch (e: any) {
        if (e?.status === 401) return router.push("/login");
        setError(getNetworkErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Spinner /></div>;
  }

  const done = gens.filter((g) => g.status === "completed").length;
  const running = gens.filter((g) => ["pending", "queued", "processing"].includes(g.status)).length;
  const failed = gens.filter((g) => g.status === "failed").length;
  const recent = gens.slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Bonjour{user?.name ? `, ${user.name}` : ""}</h1>
          <p className="mt-1 text-sm text-muted">{user?.email}</p>
        </div>
        <Link href="/create" className="btn-primary !px-5 !py-3">Nouvelle vidéo</Link>
      </div>

      {error && <div className="mt-5"><Alert>{error}</Alert></div>}

      {user?.role === "admin" && (
        <Link href="/admin" className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-accent/60 bg-accent/20 px-5 py-4 transition-colors hover:bg-accent/30">
          <span className="flex items-center gap-3">
            <IconShield className="h-6 w-6" />
            <span>
              <span className="block font-semibold">Espace administrateur</span>
              <span className="block text-sm text-muted">Clés API, utilisateurs, crédits et générations.</span>
            </span>
          </span>
          <span className="text-sm font-semibold">Ouvrir</span>
        </Link>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Crédits restants", value: user?.credits ?? 0, cls: "text-ink", dot: "bg-accent" },
          { label: "Vidéos terminées", value: done, cls: "text-ok", dot: "bg-ok" },
          { label: "En cours", value: running, cls: "text-brand", dot: "bg-brand" },
          { label: "Échouées", value: failed, cls: "text-bad", dot: "bg-bad" },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <p className="flex items-center gap-2 text-sm text-muted">
              <span className={`h-2 w-2 rounded-full ${s.dot}`} />
              {s.label}
            </p>
            <p className={`mt-2 font-display text-4xl font-bold tabular-nums ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <section className="card mt-8 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Dernières vidéos</h2>
          <Link href="/history" className="text-sm font-semibold text-brand hover:underline">Tout voir</Link>
        </div>
        {recent.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted">Vous n&apos;avez pas encore créé de vidéo.</p>
            <Link href="/create" className="btn-primary mt-4">Créer ma première vidéo</Link>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {recent.map((g) => (
              <li key={g.id}>
                <Link href={`/generations/${g.id}`} className="flex items-center justify-between gap-4 py-3.5 hover:text-brand">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{g.prompt}</span>
                    <span className="mt-0.5 block text-xs text-muted">{MODE_LABEL[g.mode] || g.mode} · {g.format} · {g.durationSeconds} s</span>
                  </span>
                  <StatusBadge status={g.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
