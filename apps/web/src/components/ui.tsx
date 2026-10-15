import type { ReactNode, CSSProperties } from "react";

/* ---------- Icônes (SVG inline, pas d'emoji) ---------- */
type IconProps = { className?: string };
const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const IconSun = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
export const IconMoon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
);
export const IconMenu = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
export const IconClose = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconImage = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4 18 5-5 4 4 3-3 4 4" />
  </svg>
);
export const IconText = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M5 6h14M12 6v13M9 19h6" />
  </svg>
);
export const IconUpload = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
  </svg>
);
export const IconCheck = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const IconShield = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
  </svg>
);
export const IconPlay = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M8 5v14l11-7L8 5Z" />
  </svg>
);

/* ---------- Spinner ---------- */
export function Spinner({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Chargement"
      className={`${className} animate-spin rounded-full border-[3px] border-brand/25 border-t-brand`}
    />
  );
}

/* ---------- Alerte ---------- */
export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "info" | "success" | "warn";
  children: ReactNode;
}) {
  const tones = {
    error: "border-bad/30 bg-bad-soft text-bad",
    info: "border-brand/30 bg-brand-soft text-brand",
    success: "border-ok/30 bg-ok-soft text-ok",
    warn: "border-warn/30 bg-warn-soft text-warn",
  } as const;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

/* ---------- Statut de génération ---------- */
const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "En attente", cls: "bg-warn-soft text-warn" },
  queued: { label: "En file", cls: "bg-warn-soft text-warn" },
  processing: { label: "En cours", cls: "bg-brand-soft text-brand" },
  completed: { label: "Terminée", cls: "bg-ok-soft text-ok" },
  failed: { label: "Échouée", cls: "bg-bad-soft text-bad" },
  cancelled: { label: "Annulée", cls: "bg-sunken text-muted" },
};

export function statusLabel(status: string) {
  return STATUS[status]?.label ?? status;
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, cls: "bg-sunken text-muted" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

export const MODE_LABEL: Record<string, string> = {
  PROMPT_ONLY: "Texte → vidéo",
  IMAGE_TO_VIDEO: "Image → vidéo",
};

/* ---------- Viseur : cadre au bon format avec repères de cadrage ---------- */
export const RATIO_CSS: Record<string, string> = {
  "9:16": "9 / 16",
  "16:9": "16 / 9",
  "1:1": "1 / 1",
  "4:5": "4 / 5",
  "3:4": "3 / 4",
};

export function ViewFinder({
  ratio,
  children,
  rec = false,
  className = "",
  style,
}: {
  ratio: string;
  children?: ReactNode;
  rec?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-line bg-sunken ${className}`}
      style={{ aspectRatio: RATIO_CSS[ratio] ?? "16 / 9", ...style }}
    >
      {children}
      <span className="vf-corner vf-tl" />
      <span className="vf-corner vf-tr" />
      <span className="vf-corner vf-bl" />
      <span className="vf-corner vf-br" />
      <span className="absolute left-1/2 top-3 -translate-x-1/2 rounded-md bg-ink/70 px-2 py-0.5 text-[11px] font-semibold text-paper">
        {rec && <span className="rec-dot mr-1 inline-block h-1.5 w-1.5 rounded-full bg-bad align-middle" />}
        {ratio}
      </span>
    </div>
  );
}
