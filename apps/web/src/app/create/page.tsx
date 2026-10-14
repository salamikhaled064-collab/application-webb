"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getApiUrl, getNetworkErrorMessage } from "../../lib/api";

const STYLES = [
  { id: "none", label: "Aucun" },
  { id: "cinematic", label: "Cinématique" },
  { id: "realistic", label: "Réaliste" },
  { id: "artistic", label: "Artistique" },
  { id: "dynamic", label: "Dynamique" },
  { id: "anime", label: "Anime" },
];
const FORMATS = ["9:16", "16:9", "1:1", "4:5"] as const;
const DURATIONS = [3, 5, 10, 18] as const;
const CAMERAS = [
  "Léger zoom avant",
  "Panoramique lent",
  "Caméra fixe",
  "Mouvement dynamique",
  "Orbital",
];
const COSTS: Record<number, number> = { 3: 1, 5: 2, 10: 4, 18: 7 };

const PROMPT_EXAMPLE =
  "Une femme présente un nouveau produit dans un studio lumineux, caméra dynamique, style publicitaire premium, éclairage naturel.";
const ANIMATE_EXAMPLE =
  "Anime cette image avec un léger mouvement de caméra vers l'avant, fais bouger doucement les éléments et ajoute une lumière cinématique.";

type Mode = "PROMPT_ONLY" | "IMAGE_TO_VIDEO";

export default function CreatePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("PROMPT_ONLY");
  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState<(typeof FORMATS)[number]>("9:16");
  const [style, setStyle] = useState("realistic");
  const [duration, setDuration] = useState<number>(5);
  const [camera, setCamera] = useState(CAMERAS[0]);
  const [imageId, setImageId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onFile = useCallback(async (file: File | null) => {
    if (!file) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Formats autorisés : JPEG, PNG, WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("L'image est trop volumineuse (max 10 Mo).");
      return;
    }
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const data = await apiFetch<{ imageId: string }>("/api/uploads/image", {
        method: "POST",
        body: form,
        headers: {}, // FormData – no Content-Type
      });
      setImageId(data.imageId);
    } catch (e) {
      setError(getNetworkErrorMessage(e));
      setPreview(null);
      setImageId(null);
    } finally {
      setUploading(false);
    }
  }, []);

  async function handleGenerate() {
    setError("");
    if (prompt.trim().length < 10) {
      setError("Le prompt doit contenir au moins 10 caractères.");
      return;
    }
    if (mode === "IMAGE_TO_VIDEO" && !imageId) {
      setError("Importez une image pour ce mode.");
      return;
    }
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

      const data = await apiFetch<{ id: string }>("/api/generations", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (data.id) {
        router.push(`/generations/${data.id}`);
        return;
      }
      setError("Réponse invalide du serveur");
    } catch (e: any) {
      if (e.status === 401) {
        router.push("/login");
        return;
      }
      setError(getNetworkErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#f8f7f4] dark:bg-slate-950">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Créer une vidéo IA
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          Choisissez un mode, décrivez la scène, lancez la génération
        </p>

        {/* Mode tabs */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode("PROMPT_ONLY")}
            className={`rounded-2xl border-2 p-4 text-left transition ${
              mode === "PROMPT_ONLY"
                ? "border-violet-500 bg-violet-50 shadow-md dark:bg-violet-950/40"
                : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900"
            }`}
          >
            <p className="text-lg">✨</p>
            <p className="mt-1 font-semibold text-slate-900 dark:text-white">Générer avec un prompt</p>
            <p className="mt-1 text-xs text-slate-500">Texte seul → vidéo (sans image)</p>
          </button>
          <button
            type="button"
            onClick={() => setMode("IMAGE_TO_VIDEO")}
            className={`rounded-2xl border-2 p-4 text-left transition ${
              mode === "IMAGE_TO_VIDEO"
                ? "border-sky-500 bg-sky-50 shadow-md dark:bg-sky-950/40"
                : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900"
            }`}
          >
            <p className="text-lg">🖼️</p>
            <p className="mt-1 font-semibold text-slate-900 dark:text-white">Animer une image</p>
            <p className="mt-1 text-xs text-slate-500">Image + prompt → vidéo animée</p>
          </button>
        </div>

        <div className="mt-8 space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {mode === "IMAGE_TO_VIDEO" && (
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Image source</label>
              <div
                className="mt-2 flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-800"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onFile(e.dataTransfer.files[0] || null);
                }}
                onClick={() => document.getElementById("img-input")?.click()}
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="Aperçu" className="max-h-40 rounded-lg object-contain" />
                ) : (
                  <p className="text-sm text-slate-500">
                    {uploading ? "Upload…" : "Glissez une image ou cliquez (JPEG, PNG, WebP · max 10 Mo)"}
                  </p>
                )}
                <input
                  id="img-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0] || null)}
                />
              </div>
              {preview && (
                <button
                  type="button"
                  className="mt-2 text-xs text-red-600 hover:underline"
                  onClick={() => {
                    setPreview(null);
                    setImageId(null);
                  }}
                >
                  Supprimer l&apos;image
                </button>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Prompt</label>
              <span className="text-xs text-slate-400">{prompt.length}/1500</span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, 1500))}
              rows={4}
              placeholder={mode === "PROMPT_ONLY" ? PROMPT_EXAMPLE : ANIMATE_EXAMPLE}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-slate-600 dark:bg-slate-800"
            />
            <button
              type="button"
              className="mt-1 text-xs text-violet-600 hover:underline"
              onClick={() => setPrompt(mode === "PROMPT_ONLY" ? PROMPT_EXAMPLE : ANIMATE_EXAMPLE)}
            >
              Utiliser l&apos;exemple
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Format</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      format === f
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Durée</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      duration === d
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800"
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Style</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyle(s.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    style === s.id
                      ? "bg-violet-600 text-white"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Mouvement de caméra</label>
            <select
              value={camera}
              onChange={(e) => setCamera(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              {CAMERAS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="text-sm text-slate-500">
              Coût : <span className="font-semibold text-slate-900 dark:text-white">{COSTS[duration]} crédits</span>
            </p>
            <button
              type="button"
              disabled={submitting || uploading}
              onClick={handleGenerate}
              className="rounded-full bg-gradient-to-r from-violet-600 to-sky-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:opacity-95 disabled:opacity-50"
            >
              {submitting ? "Envoi…" : "Générer la vidéo"}
            </button>
          </div>
        </div>

        {!getApiUrl() && (
          <p className="mt-4 text-center text-xs text-amber-600">
            Attention : NEXT_PUBLIC_API_URL n&apos;est pas définie — les appels API échoueront en production.
          </p>
        )}
      </div>
    </div>
  );
}
