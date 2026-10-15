"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getNetworkErrorMessage, notifyAuthChanged } from "../../lib/api";
import { Alert, IconCheck, IconImage, IconText, IconUpload, ViewFinder } from "../../components/ui";

type Mode = "PROMPT_ONLY" | "IMAGE_TO_VIDEO";

const STYLES = [
  { id: "none", label: "Aucun" },
  { id: "cinematic", label: "Cinéma" },
  { id: "realistic", label: "Réaliste" },
  { id: "artistic", label: "Artistique" },
  { id: "dynamic", label: "Dynamique" },
  { id: "anime", label: "Anime" },
];
const FORMATS = [
  { id: "9:16", label: "Vertical", hint: "TikTok, Reels, Shorts" },
  { id: "16:9", label: "Horizontal", hint: "YouTube, TV" },
  { id: "1:1", label: "Carré", hint: "Feed Instagram" },
  { id: "3:4", label: "Portrait", hint: "Feed Instagram, Facebook" },
] as const;
// Agnes Video 2.5 : clips de 4 à 12 secondes
const DURATIONS = [4, 6, 8, 10, 12] as const;
const COSTS: Record<number, number> = { 4: 1, 6: 2, 8: 3, 10: 4, 12: 5 };
const CAMERAS = ["Léger zoom avant", "Panoramique lent", "Caméra fixe", "Mouvement dynamique", "Orbital"];

const EXAMPLES: Record<Mode, string> = {
  PROMPT_ONLY:
    "Une jeune entrepreneure présente un nouveau produit dans un studio lumineux, caméra dynamique, style publicitaire, lumière naturelle.",
  IMAGE_TO_VIDEO:
    "Anime cette image : léger mouvement de caméra vers l'avant, les cheveux et les vêtements bougent doucement, lumière cinématique.",
};

const STEPS = ["Mode", "Description", "Réglages", "Récapitulatif"];

export default function CreatePage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode>("PROMPT_ONLY");
  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState<string>("9:16");
  const [style, setStyle] = useState("realistic");
  const [duration, setDuration] = useState<number>(6);
  const [isAdmin, setIsAdmin] = useState(false);
  const [camera, setCamera] = useState(CAMERAS[0]);

  const [imageId, setImageId] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [credits, setCredits] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ user: { credits: number; role?: string } }>("/api/auth/me")
      .then((d) => {
        setCredits(d.user.credits);
        setIsAdmin(d.user.role === "admin");
      })
      .catch((e: any) => {
        if (e?.status === 401) router.push("/login");
      });
  }, [router]);

  const onFile = useCallback(async (file: File | null) => {
    if (!file) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Format non pris en charge. Utilisez une image JPEG, PNG ou WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Cette image dépasse 10 Mo. Choisissez une image plus légère.");
      return;
    }
    setPreview(URL.createObjectURL(file));
    setImageName(file.name);
    setImageId(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const data = await apiFetch<{ imageId: string }>("/api/uploads/image", { method: "POST", body: form });
      setImageId(data.imageId);
    } catch (e: any) {
      if (e?.status === 401) return router.push("/login");
      setError(getNetworkErrorMessage(e));
      setPreview(null);
      setImageName("");
    } finally {
      setUploading(false);
    }
  }, [router]);

  function removeImage() {
    setPreview(null);
    setImageId(null);
    setImageName("");
    if (fileInput.current) fileInput.current.value = "";
  }

  function validate(s: number): string {
    if (s === 0 && mode === "IMAGE_TO_VIDEO") {
      if (uploading) return "Patientez, l'image est en cours d'envoi.";
      if (!imageId) return "Ajoutez une image pour animer.";
    }
    if (s === 1 && prompt.trim().length < 10) return "Décrivez la scène en au moins 10 caractères.";
    return "";
  }

  function next() {
    const msg = validate(step);
    if (msg) return setError(msg);
    setError("");
    setStep((s) => Math.min(3, s + 1));
  }

  async function generate() {
    for (const s of [0, 1]) {
      const msg = validate(s);
      if (msg) {
        setStep(s);
        return setError(msg);
      }
    }
    const cost = isAdmin ? 0 : COSTS[duration] ?? 2;
    if (credits !== null && credits < cost) {
      return setError(`Il vous manque ${cost - credits} crédit(s) pour cette vidéo. Choisissez une durée plus courte.`);
    }

    setError("");
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        mode,
        prompt: prompt.trim(),
        format,
        style,
        durationSeconds: duration,
        cameraMovement: camera,
      };
      if (mode === "IMAGE_TO_VIDEO") body.imageId = imageId;
      const data = await apiFetch<{ id: string }>("/api/generations", { method: "POST", body: JSON.stringify(body) });
      notifyAuthChanged();
      router.push(`/generations/${data.id}`);
    } catch (e: any) {
      if (e?.status === 401) return router.push("/login");
      setError(getNetworkErrorMessage(e));
      setSubmitting(false);
    }
  }

  const cost = isAdmin ? 0 : COSTS[duration] ?? 2;
  const notEnough = credits !== null && credits < cost;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-bold sm:text-4xl">Créer une vidéo</h1>

      {/* Étapes */}
      <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Étapes">
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={label} aria-current={current ? "step" : undefined}>
              <div className={`h-1.5 rounded-full ${done || current ? "bg-brand" : "bg-line"}`} />
              <div className={`mt-2 flex items-center gap-1.5 text-xs font-semibold sm:text-sm ${current ? "text-ink" : "text-muted"}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${done ? "bg-brand text-on-brand" : current ? "bg-brand-soft text-brand" : "bg-sunken text-muted"}`}>
                  {done ? <IconCheck className="h-3 w-3" /> : i + 1}
                </span>
                <span className="truncate">{label}</span>
              </div>
            </li>
          );
        })}
      </ol>

      <section className="card mt-6 p-5 sm:p-7">
        {/* ÉTAPE 1 : mode */}
        {step === 0 && (
          <div>
            <h2 className="text-xl font-bold">Comment voulez-vous commencer ?</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {([
                { id: "PROMPT_ONLY", title: "À partir d'un texte", desc: "Décrivez la scène, l'IA crée la vidéo.", Icon: IconText },
                { id: "IMAGE_TO_VIDEO", title: "À partir d'une image", desc: "Importez une image et donnez-lui vie.", Icon: IconImage },
              ] as const).map(({ id, title, desc, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setMode(id); setError(""); }}
                  aria-pressed={mode === id}
                  className={`rounded-2xl border-2 p-4 text-left transition-colors ${mode === id ? "border-brand bg-brand-soft" : "border-line hover:border-muted/50"}`}
                >
                  <Icon className={`h-6 w-6 ${mode === id ? "text-brand" : "text-muted"}`} />
                  <p className="mt-3 font-semibold">{title}</p>
                  <p className="mt-1 text-sm text-muted">{desc}</p>
                </button>
              ))}
            </div>

            {mode === "IMAGE_TO_VIDEO" && (
              <div className="mt-6">
                <label className="label">Image de départ</label>
                {preview ? (
                  <div className="flex items-center gap-4 rounded-2xl border border-line bg-paper p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Aperçu de l'image" className="h-24 w-24 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{imageName}</p>
                      <p className={`mt-0.5 text-xs ${uploading ? "text-muted" : "text-ok"}`}>
                        {uploading ? "Envoi en cours…" : "Image prête"}
                      </p>
                      <button type="button" onClick={removeImage} className="mt-2 text-xs font-semibold text-bad hover:underline">
                        Retirer l&apos;image
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); onFile(e.dataTransfer.files[0] || null); }}
                    className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors ${dragging ? "border-brand bg-brand-soft" : "border-line bg-paper hover:border-muted/60"}`}
                  >
                    <IconUpload className="h-7 w-7 text-brand" />
                    <span className="text-sm font-semibold">Glissez une image ici ou cliquez pour en choisir une</span>
                    <span className="text-xs text-muted">JPEG, PNG ou WebP · 10 Mo maximum</span>
                  </button>
                )}
                <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} />
              </div>
            )}
          </div>
        )}

        {/* ÉTAPE 2 : description */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold">{mode === "PROMPT_ONLY" ? "Décrivez votre vidéo" : "Que doit-il se passer dans l'image ?"}</h2>
            <div className="mt-5">
              <div className="flex items-baseline justify-between">
                <label htmlFor="prompt" className="label">Description</label>
                <span className="mb-1.5 text-xs text-muted">{prompt.length}/1500</span>
              </div>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, 1500))}
                rows={6}
                placeholder={EXAMPLES[mode]}
                className="input resize-y leading-relaxed"
              />
              <button type="button" onClick={() => setPrompt(EXAMPLES[mode])} className="mt-2 text-sm font-semibold text-brand hover:underline">
                Utiliser un exemple
              </button>
            </div>

            <div className="mt-6">
              <p className="label">Mouvement de caméra</p>
              <div className="flex flex-wrap gap-2">
                {CAMERAS.map((c) => (
                  <button key={c} type="button" className="chip" aria-pressed={camera === c} onClick={() => setCamera(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ÉTAPE 3 : réglages */}
        {step === 2 && (
          <div className="space-y-7">
            <div>
              <h2 className="text-xl font-bold">Format</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={format === f.id}
                    onClick={() => setFormat(f.id)}
                    className={`flex flex-col items-center rounded-2xl border-2 p-3 text-center transition-colors ${format === f.id ? "border-brand bg-brand-soft" : "border-line hover:border-muted/50"}`}
                  >
                    <span className="flex h-16 items-center">
                      <span
                        className={`block rounded-md border-2 ${format === f.id ? "border-brand" : "border-muted/60"}`}
                        style={{ aspectRatio: f.id.replace(":", " / "), height: f.id === "16:9" ? 36 : f.id === "1:1" ? 48 : 60 }}
                      />
                    </span>
                    <span className="mt-1 text-sm font-semibold">{f.id}</span>
                    <span className="text-xs text-muted">{f.label}</span>
                  </button>
                ))}
              </div>
              <p className="hint">{FORMATS.find((f) => f.id === format)?.hint}</p>
            </div>

            <div>
              <h2 className="text-xl font-bold">Durée</h2>
              {isAdmin ? (
                <div className="mt-4 rounded-2xl border border-accent/60 bg-accent/15 p-4">
                  <div className="flex items-center justify-between">
                    <label htmlFor="adm-dur" className="text-sm font-semibold">Durée libre (administrateur)</label>
                    <span className="font-display text-2xl font-bold tabular-nums">{duration} s</span>
                  </div>
                  <input
                    id="adm-dur"
                    type="range"
                    min={4}
                    max={12}
                    step={1}
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                    className="mt-3 w-full accent-[rgb(var(--brand))]"
                  />
                  <p className="hint">Gratuit pour les admins. Le modèle vidéo génère des clips de 4 à 12 secondes maximum.</p>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {DURATIONS.map((d) => (
                    <button key={d} type="button" className="chip !px-4 !py-2.5" aria-pressed={duration === d} onClick={() => setDuration(d)}>
                      {d} s <span className="ml-2 text-xs opacity-70">{COSTS[d]} crédit{COSTS[d] > 1 ? "s" : ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold">Style</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {STYLES.map((s) => (
                  <button key={s.id} type="button" className="chip" aria-pressed={style === s.id} onClick={() => setStyle(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ÉTAPE 4 : récapitulatif */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold">Vérifiez avant de lancer</h2>
            <div className="mt-5 grid gap-6 sm:grid-cols-[minmax(0,220px)_1fr]">
              <div className="mx-auto w-full max-w-[220px]">
                <ViewFinder ratio={format} rec>
                  {mode === "IMAGE_TO_VIDEO" && preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="Image de départ" className="h-full w-full object-cover" />
                  ) : (
                    <p className="flex h-full items-center justify-center p-6 text-center text-xs leading-relaxed text-muted">
                      {prompt.length > 110 ? prompt.slice(0, 110) + "…" : prompt}
                    </p>
                  )}
                </ViewFinder>
              </div>

              <dl className="divide-y divide-line text-sm">
                {[
                  ["Mode", mode === "PROMPT_ONLY" ? "Texte → vidéo" : "Image → vidéo"],
                  ["Format", format],
                  ["Durée", `${duration} secondes`],
                  ["Style", STYLES.find((s) => s.id === style)?.label],
                  ["Caméra", camera],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2.5">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right font-semibold">{v}</dd>
                  </div>
                ))}
                <div className="py-2.5">
                  <dt className="text-muted">Description</dt>
                  <dd className="mt-1 line-clamp-4 font-medium">{prompt}</dd>
                </div>
              </dl>
            </div>

            <div className={`mt-6 flex items-center justify-between rounded-2xl border px-4 py-3 ${notEnough ? "border-bad/40 bg-bad-soft" : "border-line bg-paper"}`}>
              <div>
                <p className="text-sm text-muted">Coût de cette vidéo</p>
                {credits !== null && <p className={`text-xs ${notEnough ? "text-bad" : "text-muted"}`}>Votre solde : {credits} crédit{credits > 1 ? "s" : ""}</p>}
              </div>
              <p className="font-display text-2xl font-bold">{isAdmin ? "Gratuit" : `${cost} crédit${cost > 1 ? "s" : ""}`}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-5">
            <Alert>{error}</Alert>
          </div>
        )}

        <div className="mt-7 flex items-center justify-between border-t border-line pt-5">
          {step === 0 ? (
            <Link href="/dashboard" className="btn-ghost">Annuler</Link>
          ) : (
            <button type="button" className="btn-ghost" onClick={() => { setError(""); setStep(step - 1); }}>
              Retour
            </button>
          )}

          {step < 3 ? (
            <button type="button" className="btn-primary" onClick={next} disabled={uploading}>
              Continuer
            </button>
          ) : (
            <button type="button" className="btn-primary !px-6 !py-3" onClick={generate} disabled={submitting || notEnough}>
              {submitting ? "Envoi en cours…" : "Générer la vidéo"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
