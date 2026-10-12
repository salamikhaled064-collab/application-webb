import Link from "next/link";

const features = [
  {
    icon: "🎬",
    title: "Image → Vidéo",
    desc: "Animez n'importe quelle image avec un simple prompt textuel. Mouvements, caméra, ambiance : tout est contrôlable.",
  },
  {
    icon: "📱",
    title: "Tous les formats",
    desc: "9:16 pour TikTok & Reels, 16:9 pour YouTube, 1:1 et 4:5 pour les réseaux sociaux.",
  },
  {
    icon: "✨",
    title: "Styles pro",
    desc: "Cinématique, réaliste, artistique, dynamique ou anime. Choisissez l'ambiance qui correspond à votre projet.",
  },
  {
    icon: "⚡",
    title: "Génération rapide",
    desc: "Suivez la progression en temps réel. Recevez votre vidéo en quelques secondes à quelques minutes.",
  },
  {
    icon: "📊",
    title: "Historique & crédits",
    desc: "Retrouvez toutes vos générations. Payez uniquement ce que vous utilisez grâce au système de crédits.",
  },
  {
    icon: "🔒",
    title: "Sécurisé",
    desc: "Vos images et vidéos restent privées. Clés API chiffrées, téléchargements contrôlés, données protégées.",
  },
];

const steps = [
  { n: "1", title: "Uploadez une image", desc: "JPEG, PNG ou WebP" },
  { n: "2", title: "Décrivez le mouvement", desc: "Prompt libre ou guidé" },
  { n: "3", title: "Choisissez format & style", desc: "Durée et résolution" },
  { n: "4", title: "Téléchargez la vidéo", desc: "MP4 prêt à publier" },
];

export default function HomePage() {
  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
        <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-sky-200/30 blur-3xl dark:bg-sky-900/20" />
        <div className="absolute -bottom-40 left-0 h-96 w-96 rounded-full bg-indigo-200/30 blur-3xl dark:bg-indigo-900/20" />

        <div className="relative mx-auto max-w-6xl px-4 py-20 text-center sm:py-28">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            Génération vidéo par IA
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
            Transformez une image
            <br />
            <span className="bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">
              en vidéo animée
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            Uploadez une image, décrivez le mouvement souhaité, choisissez le format et la durée.
            Notre IA génère une vidéo professionnelle en quelques secondes.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/create"
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-sky-600/25 hover:bg-sky-700"
            >
              Créer une vidéo
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="/register"
              className="rounded-xl border border-slate-300 bg-white px-8 py-3.5 text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Commencer gratuitement
            </Link>
          </div>

          <p className="mt-4 text-xs text-slate-400">
            5 crédits offerts à l&apos;inscription · Aucune carte bancaire requise
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="border-y border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white">
            Comment ça marche
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-lg font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                  {s.n}
                </div>
                <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white">
            Tout ce dont vous avez besoin
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-slate-500">
            Une plateforme complète pour créer, gérer et télécharger vos vidéos IA.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-sky-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-800"
              >
                <div className="text-2xl">{f.icon}</div>
                <h3 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200 bg-gradient-to-r from-sky-600 to-indigo-600 py-16 dark:border-slate-800">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Prêt à créer votre première vidéo ?
          </h2>
          <p className="mt-3 text-sky-100">
            Inscrivez-vous gratuitement et obtenez 5 crédits pour tester la plateforme.
          </p>
          <Link
            href="/create"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-sky-700 shadow-lg hover:bg-sky-50"
          >
            Lancer une génération
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
        <p>AI Video SaaS · Basé sur darkdeku225-ai-video</p>
        <p className="mt-1 text-xs text-slate-400">
          Compatible Render · Cloudflare · Google Cloud · Docker
        </p>
      </footer>
    </div>
  );
}
