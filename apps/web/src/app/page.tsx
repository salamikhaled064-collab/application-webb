import Link from "next/link";
import { ViewFinder } from "../components/ui";

const MODES = [
  {
    title: "À partir d'un texte",
    desc: "Décrivez la scène : personnages, lieu, lumière, mouvement de caméra. L'IA tourne la vidéo pour vous.",
  },
  {
    title: "À partir d'une image",
    desc: "Importez une photo ou une illustration et dites ce qui doit bouger. Votre image prend vie.",
  },
];

const STEPS = [
  ["Choisissez le mode", "Texte seul ou image à animer."],
  ["Décrivez la scène", "Quelques phrases suffisent."],
  ["Réglez le format", "Vertical, horizontal, carré, de 3 à 18 secondes."],
  ["Lancez la génération", "Suivez l'avancement et téléchargez le résultat."],
];

export default function HomePage() {
  return (
    <div>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h1 className="text-4xl font-bold leading-[1.05] sm:text-6xl">
            Une idée, une image,
            <br />
            une vidéo en quelques minutes.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Créez des vidéos pour TikTok, YouTube ou Instagram sans caméra ni montage. Partez d&apos;un texte ou animez une image que vous avez déjà.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary !px-6 !py-3.5">Créer un compte gratuit</Link>
            <Link href="/create" className="btn-secondary !px-6 !py-3.5">Essayer maintenant</Link>
          </div>
          <p className="mt-4 text-sm text-muted">Des crédits sont offerts à l&apos;inscription. Aucune carte bancaire demandée.</p>
        </div>

        <div className="flex items-end justify-center gap-4" aria-hidden>
          <ViewFinder ratio="9:16" rec className="w-36 sm:w-44">
            <div className="absolute inset-0 bg-gradient-to-b from-brand/30 via-brand-soft to-accent/40" />
          </ViewFinder>
          <div className="flex flex-col gap-4">
            <ViewFinder ratio="16:9" className="w-44 sm:w-56">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/50 to-brand/30" />
            </ViewFinder>
            <ViewFinder ratio="1:1" className="w-24 self-end sm:w-28">
              <div className="absolute inset-0 bg-gradient-to-tr from-brand/40 to-brand-soft" />
            </ViewFinder>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="text-2xl font-bold sm:text-3xl">Deux façons de créer</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {MODES.map((m) => (
            <div key={m.title} className="card p-6">
              <h3 className="text-xl font-bold">{m.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold sm:text-3xl">Comment ça marche</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, desc], i) => (
              <li key={title}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-[#14172B]">{i + 1}</span>
                <p className="mt-3 font-semibold">{title}</p>
                <p className="mt-1 text-sm text-muted">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
