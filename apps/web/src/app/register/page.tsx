"use client";

import Link from "next/link";
import { useState } from "react";

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-sm font-bold text-white">
              AI
            </div>
            <span className="text-lg font-semibold">AI Video</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Créer un compte</h1>
          <p className="mt-1 text-sm text-slate-500">
            5 crédits offerts · Aucune carte requise
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              const form = e.currentTarget;
              const name = (form.elements.namedItem("name") as HTMLInputElement).value;
              const email = (form.elements.namedItem("email") as HTMLInputElement).value;
              const password = (form.elements.namedItem("password") as HTMLInputElement).value;
              const confirm = (form.elements.namedItem("confirm") as HTMLInputElement).value;
              if (password !== confirm) {
                alert("Les mots de passe ne correspondent pas");
                setLoading(false);
                return;
              }
              try {
                const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
                const csrfRes = await fetch(`${API}/api/auth/csrf`, { credentials: "include" });
                const { csrfToken } = await csrfRes.json().catch(() => ({ csrfToken: "" }));
                const res = await fetch(`${API}/api/auth/register`, {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
                  body: JSON.stringify({ name, email, password }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Échec");
                window.location.href = "/dashboard";
              } catch (err: any) {
                alert(err.message || "Erreur d'inscription");
                setLoading(false);
              }
            }}
          >
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Nom
              </label>
              <input
                type="text"
                required
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-600 dark:bg-slate-800"
                name="name" placeholder="Votre nom"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                E-mail
              </label>
              <input
                type="email"
                required
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-600 dark:bg-slate-800"
                name="email" placeholder="vous@exemple.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Mot de passe
              </label>
              <input
                type="password"
                required
                minLength={8}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-600 dark:bg-slate-800"
                name="password" placeholder="Minimum 8 caractères"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                name="confirm"
                required
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
            <label className="flex items-start gap-2 text-xs text-slate-500">
              <input type="checkbox" required className="mt-0.5 rounded" />
              J&apos;accepte les conditions d&apos;utilisation et la politique de confidentialité
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
            >
              {loading ? "Création…" : "Créer mon compte"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Déjà un compte ?{" "}
            <Link href="/login" className="font-medium text-sky-600 hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
