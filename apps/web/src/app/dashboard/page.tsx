import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tableau de bord</h1>
            <p className="mt-1 text-sm text-slate-500">Bienvenue sur AI Video</p>
          </div>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            + Nouvelle vidéo
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Crédits restants", value: "5", color: "text-sky-600" },
            { label: "Générations terminées", value: "0", color: "text-emerald-600" },
            { label: "En cours", value: "0", color: "text-amber-600" },
            { label: "Échouées", value: "0", color: "text-red-500" },
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

        {/* Recent */}
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Dernières vidéos</h2>
            <Link href="/history" className="text-sm font-medium text-sky-600 hover:underline">
              Voir tout →
            </Link>
          </div>
          <div className="mt-6 flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl dark:bg-slate-800">
              🎬
            </div>
            <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-300">
              Aucune vidéo pour le moment
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Créez votre première génération pour la voir ici
            </p>
            <Link
              href="/create"
              className="mt-6 rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              Créer une vidéo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
