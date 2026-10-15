"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getNetworkErrorMessage } from "../../lib/api";
import { Alert, IconShield, MODE_LABEL, Spinner, StatusBadge } from "../../components/ui";

type Tab = "overview" | "keys" | "users" | "gens";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Vue d'ensemble" },
  { id: "keys", label: "Clés API" },
  { id: "users", label: "Utilisateurs" },
  { id: "gens", label: "Générations" },
];

const KEY_STATUS: Record<string, string> = { active: "Active", disabled: "Désactivée", cooldown: "En pause (limite atteinte)" };

export default function AdminPage() {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ok" | "forbidden" | "error">("loading");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

  const [stats, setStats] = useState<any>(null);
  const [keys, setKeys] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [gens, setGens] = useState<any[]>([]);
  const [newKey, setNewKey] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [grant, setGrant] = useState<Record<string, string>>({});

  const loadAll = useCallback(async () => {
    try {
      const me = await apiFetch<{ user: { role: string } }>("/api/auth/me");
      if (me.user?.role !== "admin") return setState("forbidden");
      const [s, k, u, g] = await Promise.all([
        apiFetch("/api/admin/stats"),
        apiFetch("/api/admin/api-keys"),
        apiFetch("/api/admin/users"),
        apiFetch("/api/admin/generations"),
      ]);
      setStats(s);
      setKeys(k.keys || []);
      setUsers(u.users || []);
      setGens(g.generations || []);
      setState("ok");
    } catch (e: any) {
      if (e?.status === 401) return router.push("/login");
      if (e?.status === 403) return setState("forbidden");
      // Une erreur réseau n'est PAS un refus d'accès : on le dit clairement
      setError(getNetworkErrorMessage(e));
      setState("error");
    }
  }, [router]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function run(action: () => Promise<unknown>, success: string) {
    setNotice(null);
    try {
      await action();
      setNotice({ tone: "success", text: success });
      await loadAll();
    } catch (e) {
      setNotice({ tone: "error", text: getNetworkErrorMessage(e) });
    }
  }

  if (state === "loading") {
    return <div className="flex min-h-[50vh] items-center justify-center"><Spinner /></div>;
  }

  if (state === "error") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Alert>{error}</Alert>
        <button onClick={() => { setState("loading"); loadAll(); }} className="btn-secondary mt-5">Réessayer</button>
      </div>
    );
  }

  if (state === "forbidden") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="card p-7 text-center">
          <IconShield className="mx-auto h-9 w-9 text-muted" />
          <h1 className="mt-3 text-2xl font-bold">Réservé aux administrateurs</h1>
          <p className="mt-2 text-sm text-muted">
            Ce compte n&apos;est pas administrateur. Pour en créer un, définissez <code className="rounded bg-sunken px-1.5 py-0.5">ADMIN_BOOTSTRAP_EMAIL</code> et{" "}
            <code className="rounded bg-sunken px-1.5 py-0.5">ADMIN_BOOTSTRAP_PASSWORD</code> sur le service API, puis redéployez.
          </p>
          <Link href="/dashboard" className="btn-secondary mt-5">Retour au tableau de bord</Link>
        </div>
      </div>
    );
  }

  const fmt = (d?: string) => (d ? new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-[#14172B]"><IconShield /></span>
        <div>
          <h1 className="text-3xl font-bold">Administration</h1>
          <p className="text-sm text-muted">Clés API, utilisateurs, crédits et générations.</p>
        </div>
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${tab === t.id ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {notice && <div className="mt-5"><Alert tone={notice.tone}>{notice.text}</Alert></div>}

      {tab === "overview" && stats && (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
          {[
            ["Utilisateurs", stats.users],
            ["Générations", stats.generations],
            ["En cours", stats.processing ?? 0],
            ["Terminées", stats.completed],
            ["Échouées", stats.failed],
            ["Clés API actives", stats.activeKeys],
          ].map(([l, v]) => (
            <div key={l as string} className="card p-5">
              <p className="text-sm text-muted">{l}</p>
              <p className="mt-2 font-display text-4xl font-bold tabular-nums">{v as number}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "keys" && (
        <div className="mt-6 space-y-5">
          <div className="card p-5">
            <label htmlFor="newkey" className="label">Ajouter une clé Agnes</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id="newkey" type="password" autoComplete="off" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Collez la clé : elle ne sera plus jamais affichée en clair" className="input" />
              <button
                className="btn-primary shrink-0"
                disabled={newKey.trim().length < 8}
                onClick={() => run(async () => { await apiFetch("/api/admin/api-keys", { method: "POST", body: JSON.stringify({ key: newKey.trim() }) }); setNewKey(""); }, "Clé ajoutée.")}
              >
                Ajouter la clé
              </button>
            </div>
            <p className="hint">Les clés sont chiffrées en base. Pour utiliser les vraies vidéos, passez VIDEO_PROVIDER à « agnes » sur le service API.</p>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  {["Clé", "Statut", "Utilisations", "Erreurs", "Pause jusqu'à", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap p-3.5 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {keys.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted">Aucune clé enregistrée.</td></tr>
                )}
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td className="p-3.5 font-mono text-xs">{k.maskedKey}</td>
                    <td className="p-3.5">{KEY_STATUS[k.status] || k.status}</td>
                    <td className="p-3.5 tabular-nums">{k.usageCount}</td>
                    <td className="p-3.5 tabular-nums">{k.errorCount}</td>
                    <td className="p-3.5 text-xs">{fmt(k.disabledUntil)}</td>
                    <td className="space-x-3 whitespace-nowrap p-3.5 text-right">
                      {k.status === "active" ? (
                        <button className="text-sm font-semibold text-warn hover:underline" onClick={() => run(() => apiFetch(`/api/admin/api-keys/${k.id}`, { method: "PATCH", body: JSON.stringify({ status: "disabled" }) }), "Clé désactivée.")}>Désactiver</button>
                      ) : (
                        <button className="text-sm font-semibold text-ok hover:underline" onClick={() => run(() => apiFetch(`/api/admin/api-keys/${k.id}`, { method: "PATCH", body: JSON.stringify({ status: "active" }) }), "Clé activée.")}>Activer</button>
                      )}
                      <button className="text-sm font-semibold text-bad hover:underline" onClick={() => { if (confirm("Supprimer cette clé ?")) run(() => apiFetch(`/api/admin/api-keys/${k.id}`, { method: "DELETE" }), "Clé supprimée."); }}>Supprimer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                {["Utilisateur", "Rôle", "Crédits", "Inscrit le", "Ajouter des crédits"].map((h) => (
                  <th key={h} className="whitespace-nowrap p-3.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => {
                const amount = parseInt(grant[u.id] || "", 10);
                return (
                  <tr key={u.id}>
                    <td className="p-3.5">
                      <p className="font-medium">{u.email}</p>
                      {u.name && <p className="text-xs text-muted">{u.name}</p>}
                    </td>
                    <td className="p-3.5">{u.role === "admin" ? <span className="rounded-full bg-accent/40 px-2.5 py-0.5 text-xs font-semibold">Admin</span> : "Utilisateur"}</td>
                    <td className="p-3.5 font-semibold tabular-nums">{u.credits}</td>
                    <td className="whitespace-nowrap p-3.5 text-xs">{fmt(u.createdAt)}</td>
                    <td className="p-3.5">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          aria-label={`Crédits à ajouter à ${u.email}`}
                          value={grant[u.id] || ""}
                          onChange={(e) => setGrant((g) => ({ ...g, [u.id]: e.target.value }))}
                          placeholder="ex : 10"
                          className="input !w-24 !py-1.5"
                        />
                        <button
                          className="btn-secondary !py-1.5"
                          disabled={!Number.isInteger(amount) || amount === 0}
                          onClick={() => run(async () => { await apiFetch(`/api/admin/users/${u.id}/credits`, { method: "POST", body: JSON.stringify({ amount }) }); setGrant((g) => ({ ...g, [u.id]: "" })); }, "Crédits mis à jour.")}
                        >
                          Valider
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "gens" && (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                {["Date", "Utilisateur", "Mode", "Statut", "Crédits", "Erreur"].map((h) => (
                  <th key={h} className="whitespace-nowrap p-3.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {gens.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted">Aucune génération.</td></tr>}
              {gens.map((g) => (
                <tr key={g.id}>
                  <td className="whitespace-nowrap p-3.5 text-xs">{fmt(g.createdAt)}</td>
                  <td className="p-3.5 text-xs">{g.user?.email || "—"}</td>
                  <td className="whitespace-nowrap p-3.5 text-xs">{MODE_LABEL[g.mode] || g.mode} · {g.format} · {g.durationSeconds} s</td>
                  <td className="p-3.5"><StatusBadge status={g.status} /></td>
                  <td className="whitespace-nowrap p-3.5 text-xs">{g.creditsUsed} ({g.creditStatus})</td>
                  <td className="max-w-xs p-3.5 text-xs text-bad">{g.errorMessage || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
