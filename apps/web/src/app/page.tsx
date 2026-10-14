import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] overflow-hidden bg-[#f7f6f3] text-slate-900 dark:bg-slate-950 dark:text-white">
      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-4 pb-24 pt-16 sm:pt-24">
        {/* Decorative floating cards */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[4%] top-20 hidden w-28 rotate-[-12deg] overflow-hidden rounded-2xl shadow-xl sm:block lg:w-36">
            <div className="aspect-[9/16] bg-gradient-to-br from-violet-400 to-fuchsia-500" />
          </div>
          <div className="absolute right-[6%] top-16 hidden w-28 rotate-[10deg] overflow-hidden rounded-2xl shadow-xl sm:block lg:w-36">
            <div className="aspect-[9/16] bg-gradient-to-br from-sky-400 to-indigo-600" />
          </div>
          <div className="absolute bottom-8 left-[12%] hidden w-24 rotate-[-6deg] overflow-hidden rounded-2xl shadow-lg md:block">
            <div className="aspect-[9/16] bg-gradient-to-br from-amber-300 to-rose-400" />
          </div>
          <div className="absolute bottom-12 right-[10%] hidden w-24 rotate-[8deg] overflow-hidden rounded-2xl shadow-lg md:block">
            <div className="aspect-[9/16] bg-gradient-to-br from-emerald-300 to-teal-600" />
          </div>
        </div>

        <div className="relative z-10 mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-medium text-violet-700 shadow-sm dark:border-violet-800 dark:bg-slate-900 dark:text-violet-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Essai gratuit · crédits offerts
          </span>

          <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Créez des vidéos qui
            <span className="bg-gradient-to-r from-violet-600 to-sky-500 bg-clip-text text-transparent">
              {" "}
              captent l&apos;attention
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-lg text-base text-slate-600 dark:text-slate-400 sm:text-lg">
            Transformez une idée ou une image en vidéo grâce à une génération IA rapide et créative.
            Prompt seul ou image animée — à vous de choisir.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/create"
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 dark:bg-white dark:text-slate-900"
            >
              Commencer la création
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-8 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              Créer un compte
            </Link>
          </div>
        </div>
      </section>

      {/* Modes */}
      <section className="border-t border-slate-200/80 bg-white py-20 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">Deux façons de créer</h2>
          <p className="mx-auto mt-3 max-w-md text-center text-sm text-slate-500">
            Choisissez le mode qui correspond à votre projet
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-8 shadow-sm dark:border-violet-900 dark:from-violet-950/40 dark:to-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-xl text-white">
                ✨
              </div>
              <h3 className="mt-5 text-xl font-bold">Générer avec un prompt</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Décrivez la scène, le mouvement et le style. L&apos;IA produit une vidéo complète sans image
                source — idéal pour tester des idées rapidement.
              </p>
              <Link
                href="/create"
                className="mt-6 inline-block text-sm font-semibold text-violet-600 hover:underline"
              >
                Essayer le mode prompt →
              </Link>
            </div>
            <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-8 shadow-sm dark:border-sky-900 dark:from-sky-950/40 dark:to-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-600 text-xl text-white">
                🖼️
              </div>
              <h3 className="mt-5 text-xl font-bold">Animer une image</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Importez une photo ou un visuel, décrivez l&apos;animation souhaitée. Parfait pour les
                produits, portraits et contenus réseaux sociaux.
              </p>
              <Link
                href="/create"
                className="mt-6 inline-block text-sm font-semibold text-sky-600 hover:underline"
              >
                Essayer le mode image →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 sm:grid-cols-3">
          {[
            {
              t: "Formats pro",
              d: "9:16, 16:9, 1:1, 4:5 — prêts pour TikTok, Reels, YouTube et le web.",
            },
            {
              t: "Styles multiples",
              d: "Cinématique, réaliste, artistique, dynamique ou anime selon votre marque.",
            },
            {
              t: "Crédits simples",
              d: "Payez uniquement ce que vous générez. Suivi transparent dans l'historique.",
            },
          ].map((f) => (
            <div key={f.t} className="text-center">
              <h3 className="font-bold">{f.t}</h3>
              <p className="mt-2 text-sm text-slate-500">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200 bg-slate-900 py-16 text-center text-white dark:border-slate-800">
        <h2 className="text-2xl font-bold sm:text-3xl">Prêt à créer votre première vidéo ?</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">
          Inscrivez-vous gratuitement et obtenez des crédits de départ.
        </p>
        <Link
          href="/register"
          className="mt-8 inline-flex rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100"
        >
          Démarrer maintenant
        </Link>
      </section>
    </div>
  );
}
