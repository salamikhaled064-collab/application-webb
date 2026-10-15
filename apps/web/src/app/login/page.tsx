"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getNetworkErrorMessage, notifyAuthChanged } from "../../lib/api";
import { Alert } from "../../components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      notifyAuthChanged();
      router.push("/create");
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
        <h1 className="text-2xl font-bold">Connexion</h1>
        <p className="mt-1 text-sm text-muted">Accédez à votre espace de création.</p>

        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <div>
            <label htmlFor="email" className="label">Adresse e-mail</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="password" className="label">Mot de passe</label>
            <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
          </div>

          {error && <Alert>{error}</Alert>}

          <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
            {loading ? "Connexion en cours…" : "Se connecter"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Pas encore de compte ?{" "}
          <Link href="/register" className="font-semibold text-brand hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
