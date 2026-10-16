"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getNetworkErrorMessage, notifyAuthChanged } from "../../lib/api";
import { Alert } from "../../components/ui";
import { getNextPath } from "../../lib/redirect";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Le mot de passe doit contenir au moins 8 caractères.");
    if (password !== confirm) return setError("Les deux mots de passe ne correspondent pas.");
    if (!accepted) return setError("Acceptez les conditions d'utilisation pour continuer.");

    setLoading(true);
    try {
      await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      notifyAuthChanged();
      router.push(getNextPath());
      router.refresh();
    } catch (err) {
      setError(getNetworkErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-10">
      <div className="card w-full p-7 sm:p-8">
        <h1 className="text-2xl font-bold">Créer un compte</h1>
        <p className="mt-1 text-sm text-muted">Des crédits sont offerts à l&apos;inscription. Aucune carte bancaire demandée.</p>

        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <div>
            <label htmlFor="name" className="label">Nom</label>
            <input id="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="email" className="label">Adresse e-mail</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="password" className="label">Mot de passe</label>
            <input id="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
            <p className="hint">8 caractères minimum.</p>
          </div>
          <div>
            <label htmlFor="confirm" className="label">Confirmer le mot de passe</label>
            <input id="confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" />
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]" />
            J&apos;accepte les conditions d&apos;utilisation et la politique de confidentialité.
          </label>

          {error && <Alert>{error}</Alert>}

          <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
            {loading ? "Création du compte…" : "Créer mon compte"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Déjà un compte ?{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
