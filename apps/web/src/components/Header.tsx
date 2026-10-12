"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ email?: string; role?: string; credits?: number } | null>(null);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved === "dark" || (!saved && prefersDark);
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);

    fetch(`${API}/api/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUser(d?.user || null))
      .catch(() => setUser(null));
  }, [pathname]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  async function logout() {
    const csrfRes = await fetch(`${API}/api/auth/csrf`, { credentials: "include" });
    const { csrfToken } = await csrfRes.json().catch(() => ({ csrfToken: "" }));
    await fetch(`${API}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRF-Token": csrfToken },
    });
    setUser(null);
    router.push("/");
  }

  const nav = [
    { href: "/create", label: "Créer" },
    { href: "/dashboard", label: "Tableau de bord" },
    { href: "/history", label: "Historique" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-lg dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-sm font-bold text-white">
            AI
          </span>
          <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
            AI Video
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                pathname === item.href
                  ? "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {item.label}
            </Link>
          ))}
          {user?.role === "admin" && (
            <Link
              href="/admin"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                pathname === "/admin"
                  ? "bg-amber-50 text-amber-700"
                  : "text-amber-600 hover:bg-amber-50"
              }`}
            >
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {mounted && (
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Thème"
            >
              {dark ? "☀️" : "🌙"}
            </button>
          )}
          {user ? (
            <>
              <span className="hidden text-xs text-slate-500 sm:inline">
                {user.credits ?? 0} crédits
              </span>
              <button
                onClick={logout}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 sm:block"
              >
                Connexion
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
              >
                S&apos;inscrire
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
