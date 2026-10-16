import { NextResponse, type NextRequest } from "next/server";

/**
 * Sans connexion, on ne peut ni créer de vidéo ni voir l'espace membre : redirection vers /login.
 * (Contrôle rapide de présence du cookie de session ; la VRAIE vérification est faite par l'API,
 * qui refuse de toute façon toute création sans session valide.)
 */
const PROTECTED = ["/create", "/dashboard", "/history", "/generations", "/admin"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isProtected && !req.cookies.get("session_id")) {
    // Next exige une URL ABSOLUE. Derrière Render, req.nextUrl peut contenir une mauvaise origine
    // (0.0.0.0:10000) : on reconstruit l'adresse publique à partir des en-têtes du proxy.
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const proto =
      (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim() ||
      (/^(localhost|127\.0\.0\.1)/.test(host) ? "http" : "https");
    return NextResponse.redirect(`${proto}://${host}/login?next=${encodeURIComponent(pathname)}`, 307);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/create/:path*", "/dashboard/:path*", "/history/:path*", "/generations/:path*", "/admin/:path*"],
};
