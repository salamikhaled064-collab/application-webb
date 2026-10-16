/** Page où retourner après connexion (uniquement un chemin interne, jamais un site externe). */
export function getNextPath(fallback = "/create"): string {
  if (typeof window === "undefined") return fallback;
  const next = new URLSearchParams(window.location.search).get("next") || "";
  return next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : fallback;
}

export function hasNextParam(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).has("next");
}
