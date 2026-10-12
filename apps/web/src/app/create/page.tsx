"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import Link from "next/link";

const FORMATS = [
  { id: "9:16", label: "9:16", desc: "TikTok, Reels, Shorts", icon: "📱" },
  { id: "16:9", label: "16:9", desc: "YouTube, écran large", icon: "🖥️" },
  { id: "1:1", label: "1:1", desc: "Publications carrées", icon: "⬜" },
  { id: "4:5", label: "4:5", desc: "Instagram vertical", icon: "📲" },
];

const STYLES = [
  { id: "none", label: "Aucun", desc: "Style neutre" },
  { id: "cinematic", label: "Cinématique", desc: "Ambiance film" },
  { id: "realistic", label: "Réaliste", desc: "Photorealiste" },
  { id: "artistic", label: "Artistique", desc: "Peinture / art" },
  { id: "dynamic", label: "Dynamique", desc: "Mouvement fort" },
  { id: "anime", label: "Anime", desc: "Style japonais" },
];

const DURATIONS = [
  { id: 3, label: "3 s", credits: 1 },
  { id: 5, label: "5 s", credits: 2 },
  { id: 10, label: "10 s", credits: 4 },
  { id: 18, label: "18 s", credits: 7 },
];

const STEP_LABELS = ["Image", "Prompt", "Format", "Style", "Durée", "Récap"];

type Step = 0 | 1 | 2 | 3 | 4 | 5;

export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState("9:16");
  const [style, setStyle] = useState("none");
  const [duration, setDuration] = useState(5);
  const [dragOver, setDragOver] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [imageId, setImageId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const processFile = useCallback((file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("Format non supporté. Utilisez JPEG, PNG ou WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Image trop lourde (max 10 Mo).");
      return;
    }
    setImageName(file.name);
    setImageFile(file);
    setImageId(null);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function next() {
    if (step < 5) setStep((step + 1) as Step);
  }
  function prev() {
    if (step > 0) setStep((step - 1) as Step);
  }

  function canNext(): boolean {
    if (step === 0) return !!imagePreview;
    if (step === 1) return prompt.trim().length >= 10;
    return true;
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setProgress(0);
    setStatus("upload");
    setVideoUrl(null);

    try {
      // 1. Upload image if not yet uploaded
      let currentImageId = imageId;
      if (!currentImageId && imageFile) {
        const form = new FormData();
        form.append("image", imageFile);
        const csrf1 = await fetch(`${API}/api/auth/csrf`, { credentials: "include" });
        const { csrfToken: tok1 } = await csrf1.json().catch(() => ({ csrfToken: "" }));
        const upRes = await fetch(`${API}/api/uploads/image`, {
          method: "POST",
          credentials: "include",
          headers: { "X-CSRF-Token": tok1 },
          body: form,
        });
        const upData = await upRes.json();
        if (!upRes.ok) throw new Error(upData.error || "Échec de l'upload");
        currentImageId = upData.imageId;
        setImageId(currentImageId);
      }
      if (!currentImageId) throw new Error("Image manquante");

      // 2. Create generation
      setStatus("queued");
      const csrf2 = await fetch(`${API}/api/auth/csrf`, { credentials: "include" });
      const { csrfToken: tok2 } = await csrf2.json().catch(() => ({ csrfToken: "" }));
      const genRes = await fetch(`${API}/api/generations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": tok2 },
        body: JSON.stringify({
          imageId: currentImageId,
          prompt,
          format,
          style,
          durationSeconds: duration,
        }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.error || "Échec de la création");

      const gid = genData.generationId;
      setGenerationId(gid);
        router.push(`/generations/${gid}`);;
        ;
      setStatus("processing");

      // 3. Poll status
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const stRes = await fetch(`${API}/api/generations/${gid}`, {
          credentials: "include",
        });
        const st = await stRes.json();
        if (!stRes.ok) throw new Error(st.error || "Erreur de suivi");

        setProgress(st.progress || 0);
        setStatus(st.status);

        if (st.status === "completed") {
          // Prefer secure API proxy (never expose Agnes URL directly)
          const secure =
            st.id || gid
              ? `${API}/api/generations/${st.id || gid}/video`
              : st.videoUrl || null;
          setVideoUrl(secure);
          setGenerating(false);
          return;
        }
        if (st.status === "failed" || st.status === "cancelled") {
          throw new Error(st.errorMessage || "Génération échouée");
        }
      }
      throw new Error("Délai dépassé");
    } catch (e: any) {
      setError(e.message || "Erreur");
      setGenerating(false);
      setStatus("failed");
    }
  }

  const credits = DURATIONS.find((d) => d.id === duration)?.credits ?? 2;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex flex-1 flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                    i < step
                      ? "bg-sky-600 text-white"
                      : i === step
                        ? "bg-sky-600 text-white ring-4 ring-sky-100 dark:ring-sky-900"
                        : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                  }`}
                >
                  {i < step ? "✓" : i + 1}
                </div>
                <span
                  className={`mt-1.5 hidden text-[10px] font-medium sm:block ${
                    i <= step ? "text-sky-600 dark:text-sky-400" : "text-slate-400"
                  }`}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-sky-600 transition-all duration-300"
              style={{ width: `${((step + 1) / 6) * 100}%` }}
            />
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
          {/* STEP 0 – Image */}
          {step === 0 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Image de départ</h2>
              <p className="mt-1 text-sm text-slate-500">
                JPEG, PNG ou WebP · max 10 Mo
              </p>

              {imagePreview ? (
                <div className="mt-6 flex flex-col items-center gap-4">
                  <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                    <img src={imagePreview} alt="Aperçu" className="max-h-72 object-contain" />
                  </div>
                  <p className="text-xs text-slate-400">{imageName}</p>
                  <button
                    onClick={() => { setImagePreview(null); setImageName(""); }}
                    className="text-sm font-medium text-red-500 hover:text-red-600"
                  >
                    Supprimer et choisir une autre
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 transition ${
                    dragOver
                      ? "border-sky-500 bg-sky-50 dark:bg-sky-950/30"
                      : "border-slate-300 bg-slate-50 hover:border-sky-400 dark:border-slate-600 dark:bg-slate-800/50"
                  }`}
                >
                  <label className="flex cursor-pointer flex-col items-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-2xl dark:bg-sky-950">
                      📷
                    </div>
                    <span className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                      Glisser-déposer ou cliquer
                    </span>
                    <span className="mt-1 text-xs text-slate-400">
                      pour sélectionner une image
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) processFile(f);
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* STEP 1 – Prompt */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Description</h2>
              <p className="mt-1 text-sm text-slate-500">
                Décrivez les mouvements, la caméra, l&apos;éclairage, l&apos;ambiance…
              </p>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={7}
                maxLength={1500}
                placeholder="Une personne marche lentement vers la caméra tandis que ses cheveux bougent doucement avec le vent. La caméra avance de manière fluide, avec une lumière naturelle et une ambiance cinématographique."
                className="mt-4 w-full resize-none rounded-xl border border-slate-300 bg-white p-4 text-sm leading-relaxed focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-600 dark:bg-slate-800 dark:focus:border-sky-400"
              />
              <div className="mt-1 flex justify-between text-xs text-slate-400">
                <span>Minimum 10 caractères</span>
                <span>{prompt.length} / 1500</span>
              </div>
              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800">
                <strong>Conseil :</strong> mentionnez le sujet, l&apos;action, le mouvement de caméra et l&apos;ambiance pour de meilleurs résultats.
              </div>
            </div>
          )}

          {/* STEP 2 – Format */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Format vidéo</h2>
              <p className="mt-1 text-sm text-slate-500">Choisissez le ratio adapté à votre plateforme</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      format === f.id
                        ? "border-sky-500 bg-sky-50 ring-2 ring-sky-500/20 dark:bg-sky-950/40"
                        : "border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500"
                    }`}
                  >
                    <span className="text-xl">{f.icon}</span>
                    <div className="mt-2 font-semibold text-slate-900 dark:text-white">{f.label}</div>
                    <div className="text-xs text-slate-500">{f.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3 – Style */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Style visuel</h2>
              <p className="mt-1 text-sm text-slate-500">Optionnel — influence le rendu de la vidéo</p>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id)}
                    className={`rounded-xl border p-4 text-center transition ${
                      style === s.id
                        ? "border-sky-500 bg-sky-50 ring-2 ring-sky-500/20 dark:bg-sky-950/40"
                        : "border-slate-200 hover:border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    <div className="font-semibold text-slate-900 dark:text-white">{s.label}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4 – Duration */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Durée</h2>
              <p className="mt-1 text-sm text-slate-500">Plus la vidéo est longue, plus elle coûte de crédits</p>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {DURATIONS.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDuration(d.id)}
                    className={`rounded-xl border p-4 text-center transition ${
                      duration === d.id
                        ? "border-sky-500 bg-sky-50 ring-2 ring-sky-500/20 dark:bg-sky-950/40"
                        : "border-slate-200 hover:border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    <div className="text-xl font-bold text-slate-900 dark:text-white">{d.label}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {d.credits} crédit{d.credits > 1 ? "s" : ""}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5 – Summary */}
          {step === 5 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Récapitulatif</h2>
              <p className="mt-1 text-sm text-slate-500">Vérifiez avant de lancer la génération</p>

              <div className="mt-6 space-y-5">
                {imagePreview && (
                  <div className="flex items-start gap-4">
                    <img src={imagePreview} alt="" className="h-24 w-24 rounded-lg object-cover" />
                    <div className="flex-1 text-sm">
                      <p className="font-medium text-slate-900 dark:text-white">{imageName}</p>
                      <p className="mt-2 text-slate-600 dark:text-slate-300 line-clamp-3">{prompt}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Format</p>
                    <p className="mt-0.5 font-semibold">{format}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Style</p>
                    <p className="mt-0.5 font-semibold">
                      {STYLES.find((s) => s.id === style)?.label}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Durée</p>
                    <p className="mt-0.5 font-semibold">{duration}s</p>
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                  </div>
                )}

                {generating && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {status === "upload" && "Upload de l'image…"}
                        {status === "queued" && "En file d'attente…"}
                        {status === "processing" && "Génération en cours…"}
                        {!["upload","queued","processing"].includes(status || "") && "Traitement…"}
                      </span>
                      <span className="text-slate-500">{progress}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}

                {videoUrl && status === "completed" && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-emerald-600">Vidéo prête !</p>
                    <video src={videoUrl} controls className="w-full rounded-xl" />
                    <a href={videoUrl} download className="inline-flex rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
                      Télécharger
                    </a>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-800 dark:bg-sky-950/40">
                  <span className="text-sm font-medium text-sky-800 dark:text-sky-200">
                    Coût de cette génération
                  </span>
                  <span className="text-lg font-bold text-sky-700 dark:text-sky-300">
                    {credits} crédit{credits > 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6 dark:border-slate-800">
            {step > 0 ? (
              <button
                onClick={prev}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                ← Retour
              </button>
            ) : (
              <Link href="/" className="text-sm text-slate-400 hover:text-slate-600">
                Annuler
              </Link>
            )}

            {step < 5 ? (
              <button
                onClick={next}
                disabled={!canNext()}
                className="rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continuer
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
              >
                {generating ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Préparation…
                  </>
                ) : (
                  "Générer la vidéo"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
