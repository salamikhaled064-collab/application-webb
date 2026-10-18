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

const KEY_STATUS: Record<string, string> = { active: "Active", disabled: "Désactivée (refusée, quota épuisé ou manuelle)", cooldown: "En pause 1 min (limite atteinte)" };

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
  const [newKeyProvider, setNewKeyProvider] = useState<"agnes" | "byteplus">("byteplus");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [grant, setGrant] = useState<Record<string, string>>({});
  const [adm, setAdm] = useState({ email: "", name: "", password: "" });
  const [meId, setMeId] = useState("");
  const [probe, setProbe] = useState<{ keyId: string; loading: boolean; error?: string; baseUrl?: string; results?: { model: string; verdict: string; status: number; message: string }[] } | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const me = await apiFetch<{ user: { role: string; id?: string } }>("/api/auth/me");
      if (me.user?.role !== "admin") return setState("forbidden");
      setMeId(me.user.id || "");
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

  async function testKey(keyId: string) {
    setProbe({ keyId, loading: true });
    try {
      const d = await apiFetch<{ baseUrl: string; results: any[] }>(`/api/admin/api-keys/${keyId}/test`, { method: "POST" });
      setProbe({ keyId, loading: false, baseUrl: d.baseUrl, results: d.results });
    } catch (e) {
      setProbe({ keyId, loading: false, error: getNetworkErrorMessage(e) });
    }
  }

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
        <div className="mt-6 space-y-4">
          {stats.demoActive ? (
            <Alert tone="warn">
              <strong>Mode démonstration actif.</strong> Les vidéos générées sont un exemple fixe (l&apos;image et le texte ne sont pas utilisés). Pour de vraies vidéos : ajoutez au moins une clé dans l&apos;onglet « Clés API » (BytePlus recommandé). Le basculement se fait tout seul, sans modifier Render.
            </Alert>
          ) : (
            <>
              <Alert tone="success">
                Ordre des fournisseurs :{" "}
                <strong>
                  {(stats.chain as string[])
                    .map((c) => (c === "byteplus" ? "BytePlus" : c === "agnes" ? "Agnes" : c))
                    .join(" → ")}
                </strong>
                . Chaque clé est essayée à tour de rôle ; si elle échoue, la suivante prend le relais automatiquement.
              </Alert>
              {(stats.chain as string[])
                .filter((c) => c !== "mock")
                .map((c) => (
                  <p key={c} className="text-sm text-muted">
                    {c === "byteplus" ? "BytePlus" : "Agnes"} : <strong className={stats.activeKeysByProvider?.[c] > 0 ? "text-ok" : "text-bad"}>{stats.activeKeysByProvider?.[c] ?? 0} clé(s) active(s)</strong> · modèle {stats.models?.[c]}
                  </p>
                ))}
              {stats.needsPublicUrl && !stats.publicUrlConfigured && (
                <Alert tone="warn">
                  <code className="rounded bg-sunken px-1">PUBLIC_BASE_URL</code> est absente : Agnes ne pourra pas lire les images (« image → vidéo »). BytePlus n&apos;en a pas besoin.
                </Alert>
              )}
            </>
          )}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
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
        </div>
      )}

      {tab === "keys" && (
        <div className="mt-6 space-y-5">
          <div className="card p-5">
            <label htmlFor="newkey" className="label">Ajouter une clé API</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                aria-label="Fournisseur de la clé"
                value={newKeyProvider}
                onChange={(e) => setNewKeyProvider(e.target.value as "agnes" | "byteplus")}
                className="input sm:!w-44"
              >
                <option value="byteplus">BytePlus</option>
                <option value="agnes">Agnes</option>
              </select>
              <input id="newkey" type="password" autoComplete="off" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Collez la clé : elle ne sera plus jamais affichée en clair" className="input" />
              <button
                className="btn-primary shrink-0"
                disabled={newKey.trim().length < 8}
                onClick={() => run(async () => { await apiFetch("/api/admin/api-keys", { method: "POST", body: JSON.stringify({ key: newKey.trim(), provider: newKeyProvider }) }); setNewKey(""); }, "Clé ajoutée.")}
              >
                Ajouter la clé
              </button>
            </div>
            <p className="hint">
              Vous pouvez ajouter <strong>autant de clés que vous voulez</strong>. Elles sont chiffrées en base et utilisées à tour de rôle. Si une clé échoue (refusée, quota gratuit épuisé, limite atteinte), elle est mise de côté automatiquement et la suivante prend le relais. Une clé désactivée se réactive d&apos;un clic.
            </p>
          </div>

          {probe && (
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Test de la clé BytePlus</h2>
                <button className="text-sm text-muted hover:text-ink" onClick={() => setProbe(null)}>Fermer</button>
              </div>
              {probe.loading && <p className="mt-3 text-sm text-muted">Test en cours… (aucun quota n&apos;est consommé)</p>}
              {probe.error && <div className="mt-3"><Alert>{probe.error}</Alert></div>}
              {probe.results && (
                <>
                  <p className="hint">Requêtes volontairement vides vers {probe.baseUrl} : aucune vidéo n&apos;est créée, aucun quota consommé.</p>
                  <ul className="mt-3 divide-y divide-line text-sm">
                    {probe.results.map((r) => {
                      const v: Record<string, { label: string; cls: string }> = {
                        recognized: { label: "Reconnu : accès probable", cls: "text-ok" },
                        no_access: { label: "Inaccessible avec cette clé", cls: "text-bad" },
                        key_refused: { label: "Clé refusée", cls: "text-bad" },
                        rate_limited: { label: "Limite de requêtes", cls: "text-warn" },
                        error: { label: "Erreur", cls: "text-warn" },
                        unexpected: { label: "Réponse inattendue", cls: "text-warn" },
                      };
                      const x = v[r.verdict] || v.error;
                      return (
                        <li key={r.model} className="py-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <code className="rounded bg-sunken px-1.5 py-0.5 text-xs">{r.model}</code>
                            <strong className={x.cls}>{x.label}</strong>
                          </div>
                          {r.verdict !== "recognized" && <p className="mt-1 break-words text-xs text-muted">HTTP {r.status} : {r.message}</p>}
                        </li>
                      );
                    })}
                  </ul>
                  {probe.results.every((r) => r.verdict === "no_access") && (
                    <div className="mt-4">
                      <Alert tone="warn">
                        Aucun modèle n&apos;est accessible avec cette clé. Vérifiez dans la console BytePlus (ModelArk) que la clé vient bien du même compte, puis la page « Activation Management » : l&apos;état du modèle Seedance et son quota gratuit.
                      </Alert>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  {["Clé", "Fournisseur", "Statut", "Succès / essais", "Dernière erreur", "Pause jusqu'à", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap p-3.5 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {keys.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted">Aucune clé enregistrée.</td></tr>
                )}
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td className="p-3.5 font-mono text-xs">{k.maskedKey}</td>
                    <td className="p-3.5 capitalize">{k.provider}</td>
                    <td className="p-3.5">{KEY_STATUS[k.status] || k.status}</td>
                    <td className="p-3.5 tabular-nums">{k.successCount} / {k.usageCount}</td>
                    <td className="max-w-xs p-3.5 text-xs text-bad">{k.lastError || ""}</td>
                    <td className="p-3.5 text-xs">{fmt(k.disabledUntil)}</td>
                    <td className="space-x-3 whitespace-nowrap p-3.5 text-right">
                      {k.provider === "byteplus" && (
                        <button className="text-sm font-semibold text-brand hover:underline" onClick={() => testKey(k.id)}>Tester</button>
                      )}
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
        <div className="mt-6 space-y-5">
        <div className="card p-5">
          <h2 className="text-lg font-bold">Créer un administrateur</h2>
          <p className="hint !mt-1">Crée un nouveau compte avec les droits admin. Pour un compte existant, utilisez « Promouvoir » dans le tableau.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <input className="input" type="email" placeholder="E-mail" autoComplete="off" value={adm.email} onChange={(e) => setAdm({ ...adm, email: e.target.value })} aria-label="E-mail du nouvel admin" />
            <input className="input" type="text" placeholder="Nom (facultatif)" value={adm.name} onChange={(e) => setAdm({ ...adm, name: e.target.value })} aria-label="Nom du nouvel admin" />
            <input className="input" type="password" placeholder="Mot de passe (10+ caractères)" autoComplete="new-password" value={adm.password} onChange={(e) => setAdm({ ...adm, password: e.target.value })} aria-label="Mot de passe du nouvel admin" />
          </div>
          <button
            className="btn-primary mt-3"
            disabled={!adm.email.includes("@") || adm.password.length < 10}
            onClick={() => run(async () => { await apiFetch("/api/admin/admins", { method: "POST", body: JSON.stringify({ email: adm.email, name: adm.name || undefined, password: adm.password }) }); setAdm({ email: "", name: "", password: "" }); }, "Administrateur créé.")}
          >
            Créer l&apos;administrateur
          </button>
        </div>
        <div className="card overflow-x-auto">
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
                    <td className="p-3.5">
                      <div className="flex flex-col items-start gap-1.5">
                        {u.role === "admin" ? <span className="rounded-full bg-accent/40 px-2.5 py-0.5 text-xs font-semibold">Admin</span> : <span>Utilisateur</span>}
                        {u.id !== meId && (
                          u.role === "admin" ? (
                            <button className="text-xs font-semibold text-bad hover:underline" onClick={() => { if (confirm(`Retirer les droits admin à ${u.email} ?`)) run(() => apiFetch(`/api/admin/users/${u.id}/role`, { method: "PATCH", body: JSON.stringify({ role: "user" }) }), "Droits admin retirés."); }}>Retirer admin</button>
                          ) : (
                            <button className="text-xs font-semibold text-brand hover:underline" onClick={() => { if (confirm(`Donner les droits admin à ${u.email} ?`)) run(() => apiFetch(`/api/admin/users/${u.id}/role`, { method: "PATCH", body: JSON.stringify({ role: "admin" }) }), "Utilisateur promu administrateur."); }}>Promouvoir admin</button>
                          )
                        )}
                      </div>
                    </td>
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
