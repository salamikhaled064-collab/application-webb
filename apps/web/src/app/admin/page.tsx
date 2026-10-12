"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function api(path: string, opts: RequestInit = {}) {
  // CSRF
  const csrfRes = await fetch(`${API}/api/auth/csrf`, { credentials: "include" });
  const { csrfToken } = await csrfRes.json().catch(() => ({ csrfToken: "" }));
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  };
  if (opts.method && opts.method !== "GET") {
    headers["X-CSRF-Token"] = csrfToken;
    if (!headers["Content-Type"] && opts.body) headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API}${path}`, {
    ...opts,
    credentials: "include",
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export default function AdminPage() {
  const [forbidden, setForbidden] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [keys, setKeys] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [gens, setGens] = useState<any[]>([]);
  const [newKey, setNewKey] = useState("");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"stats" | "keys" | "users" | "gens">("stats");

  useEffect(() => {
    (async () => {
      try {
        const me = await api("/api/auth/me");
        if (me.user?.role !== "admin") {
          setForbidden(true);
          return;
        }
        const [s, k, u, g] = await Promise.all([
          api("/api/admin/stats"),
          api("/api/admin/api-keys"),
          api("/api/admin/users"),
          api("/api/admin/generations"),
        ]);
        setStats(s);
        setKeys(k.keys || []);
        setUsers(u.users || []);
        setGens(g.generations || []);
      } catch {
        setForbidden(true);
      }
    })();
  }, []);

  async function addKey() {
    try {
      setMsg("");
      await api("/api/admin/api-keys", {
        method: "POST",
        body: JSON.stringify({ key: newKey }),
      });
      setNewKey("");
      const k = await api("/api/admin/api-keys");
      setKeys(k.keys || []);
      setMsg("Clé ajoutée (masquée)");
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function setKeyStatus(id: string, status: "active" | "disabled") {
    await api(`/api/admin/api-keys/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    const k = await api("/api/admin/api-keys");
    setKeys(k.keys || []);
  }

  async function deleteKey(id: string) {
    if (!confirm("Supprimer cette clé ?")) return;
    await api(`/api/admin/api-keys/${id}`, { method: "DELETE" });
    const k = await api("/api/admin/api-keys");
    setKeys(k.keys || []);
  }

  if (forbidden) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950/40">
          <p className="text-lg font-semibold text-red-700 dark:text-red-300">Accès refusé</p>
          <p className="mt-2 text-sm text-red-600">Réservé aux administrateurs.</p>
          <Link href="/" className="mt-4 inline-block text-sm text-sky-600 hover:underline">
            Retour
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Administration</h1>
      <p className="mt-1 text-sm text-slate-500">Gestion des clés API, utilisateurs et générations</p>

      <div className="mt-6 flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {(["stats", "keys", "users", "gens"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t
                ? "border-b-2 border-sky-600 text-sky-700"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t === "stats" && "Stats"}
            {t === "keys" && "Clés API"}
            {t === "users" && "Utilisateurs"}
            {t === "gens" && "Générations"}
          </button>
        ))}
      </div>

      {tab === "stats" && stats && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Utilisateurs", stats.users],
            ["Générations", stats.generations],
            ["Terminées", stats.completed],
            ["Échouées", stats.failed],
            ["Clés actives", stats.activeKeys],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs uppercase text-slate-400">{l as string}</p>
              <p className="mt-1 text-2xl font-bold">{v as number}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "keys" && (
        <div className="mt-6 space-y-4">
          <div className="flex gap-2">
            <input
              type="password"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Nouvelle clé Agnes (ne sera jamais affichée en clair)"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <button
              onClick={addKey}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              Ajouter
            </button>
          </div>
          {msg && <p className="text-sm text-slate-600">{msg}</p>}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="p-3">Masquée</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3">Usage</th>
                  <th className="p-3">Erreurs</th>
                  <th className="p-3">Cooldown</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="p-3 font-mono text-xs">{k.maskedKey}</td>
                    <td className="p-3">{k.status}</td>
                    <td className="p-3">{k.usageCount}</td>
                    <td className="p-3">{k.errorCount}</td>
                    <td className="p-3 text-xs">
                      {k.disabledUntil ? new Date(k.disabledUntil).toLocaleString() : "—"}
                    </td>
                    <td className="p-3 space-x-2">
                      {k.status !== "active" && (
                        <button onClick={() => setKeyStatus(k.id, "active")} className="text-emerald-600 text-xs">
                          Activer
                        </button>
                      )}
                      {k.status === "active" && (
                        <button onClick={() => setKeyStatus(k.id, "disabled")} className="text-amber-600 text-xs">
                          Désactiver
                        </button>
                      )}
                      <button onClick={() => deleteKey(k.id)} className="text-red-600 text-xs">
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="p-3">E-mail</th>
                <th className="p-3">Rôle</th>
                <th className="p-3">Crédits</th>
                <th className="p-3">Créé</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.role}</td>
                  <td className="p-3">{u.credits}</td>
                  <td className="p-3 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "gens" && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Crédits</th>
                <th className="p-3">Erreur</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {gens.map((g) => (
                <tr key={g.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-3 font-mono text-xs">{g.id.slice(0, 12)}…</td>
                  <td className="p-3">{g.status}</td>
                  <td className="p-3">{g.creditsUsed} ({g.creditStatus})</td>
                  <td className="p-3 text-xs text-red-600">{g.errorMessage || "—"}</td>
                  <td className="p-3 text-xs">{new Date(g.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
