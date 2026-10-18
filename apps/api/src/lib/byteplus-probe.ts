/**
 * Diagnostic d'une clé BytePlus : l'accès à chaque modèle est vérifié avec une requête VOLONTAIREMENT
 * INVALIDE (contenu vide). Elle ne peut pas créer de vidéo et ne consomme aucun quota :
 *   401/403                  → clé refusée
 *   404 / modèle introuvable → ce modèle n'est PAS accessible avec cette clé
 *   400/422 (paramètre)      → le modèle est reconnu : accès probable
 */
export type ProbeVerdict = "recognized" | "no_access" | "key_refused" | "rate_limited" | "error" | "unexpected";

export interface ProbeResult {
  model: string;
  verdict: ProbeVerdict;
  status: number;
  message: string;
}

export function probeVerdict(status: number, code: string, message: string): ProbeVerdict {
  const raw = `${code} ${message}`;
  if (status === 401 || status === 403 || /AuthenticationError|InvalidApiKey/i.test(raw)) return "key_refused";
  if (status === 404 || /InvalidEndpointOrModel|ModelNotOpen|does not exist or you do not have access|not activated/i.test(raw)) {
    return "no_access";
  }
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "recognized";
  if (status >= 500) return "error";
  if (status >= 200 && status < 300) return "unexpected";
  return "error";
}

export async function probeBytePlusModels(
  apiKey: string,
  baseUrl: string,
  models: string[],
  timeoutMs = 15000
): Promise<ProbeResult[]> {
  const out: ProbeResult[] = [];
  for (const model of models) {
    try {
      const res = await fetch(`${baseUrl}/contents/generations/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, content: [] }), // invalide exprès : jamais de vidéo, jamais de quota
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* corps non JSON */
      }
      const code = String((typeof json?.error === "object" && json.error?.code) || json?.code || "");
      const message = String(
        (typeof json?.error === "object" && json.error?.message) || json?.error || json?.message || text || `HTTP ${res.status}`
      ).slice(0, 300);
      out.push({ model, verdict: probeVerdict(res.status, code, message), status: res.status, message });
    } catch (e: any) {
      out.push({ model, verdict: "error", status: 0, message: `Réseau : ${e?.message || "inconnu"}` });
    }
  }
  return out;
}
