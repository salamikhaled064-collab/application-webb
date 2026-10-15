"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { IconClose, IconMenu, IconMoon, IconShield, IconSun } from "./ui";

type User = { email?: string; name?: string | null; role?: string; credits?: number };

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const loadUser = useCallback(() => {
    apiFetch<{ user: User }>("/api/auth/me")
      .then((d) => setUser(d?.user || null))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    setOpen(false);
    loadUser();
  }, [pathname, loadUser]);

  useEffect(() => {
    window.addEventListener("auth:refresh", loadUser);
    return () => window.removeEventListener("auth:refresh", loadUser);
  }, [loadUser]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* navigation privée : on ignore */
    }
  }

  async function logout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* déjà déconnecté */
    }
    setUser(null);
    router.push("/");
    router.refresh();
  }

  const isAdmin = user?.role === "admin";
  const nav = [
    { href: "/create", label: "Créer" },
    { href: "/dashboard", label: "Tableau de bord" },
    { href: "/history", label: "Historique" },
  ];

  const linkCls = (href: string) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      pathname === href || pathname.startsWith(href + "/")
        ? "bg-brand-soft text-brand"
        : "text-muted hover:bg-sunken hover:text-ink"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Vidéo IA – accueil">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-on-brand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
              <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <span className="font-display text-lg font-bold tracking-tight">Vidéo IA</span>
        </Link>

        {user && (
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation principale">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className={linkCls(n.href)}>
                {n.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className={`ml-1 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  pathname.startsWith("/admin")
                    ? "bg-accent text-[#14172B]"
                    : "bg-accent/25 text-ink hover:bg-accent/45"
                }`}
              >
                <IconShield className="h-4 w-4" />
                Admin
              </Link>
            )}
          </nav>
        )}

        <div className="flex items-center gap-1.5">
          <button onClick={toggleTheme} className="btn-ghost !p-2" aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"}>
            {dark ? <IconSun /> : <IconMoon />}
          </button>

          {user ? (
            <>
              <Link
                href="/dashboard"
                className="hidden items-center gap-2 rounded-xl border border-line bg-paper px-3 py-1.5 text-sm font-semibold sm:inline-flex"
                title="Vos crédits"
              >
                <span className="h-2 w-2 rounded-full bg-accent" />
                {user.credits ?? 0} crédits
              </Link>
              <button onClick={logout} className="btn-ghost hidden !py-2 md:inline-flex">
                Déconnexion
              </button>
              <button className="btn-ghost !p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
                {open ? <IconClose /> : <IconMenu />}
              </button>
            </>
          ) : (
            ready && (
              <>
                <Link href="/login" className="btn-ghost !py-2">
                  Connexion
                </Link>
                <Link href="/register" className="btn-primary !py-2">
                  S&apos;inscrire
                </Link>
              </>
            )
          )}
        </div>
      </div>

      {/* Menu mobile : l'entrée Admin y est aussi visible */}
      {open && user && (
        <nav className="border-t border-line bg-surface px-4 pb-4 pt-2 md:hidden" aria-label="Menu mobile">
          <div className="flex flex-col gap-1">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className={linkCls(n.href)}>
                {n.label}
              </Link>
            ))}
            {isAdmin && (
              <Link href="/admin" className="flex items-center gap-2 rounded-lg bg-accent/30 px-3 py-2 text-sm font-semibold">
                <IconShield className="h-4 w-4" /> Administration
              </Link>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-line pt-3 text-sm">
              <span className="text-muted">{user.credits ?? 0} crédits</span>
              <button onClick={logout} className="btn-secondary !py-1.5">
                Déconnexion
              </button>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
