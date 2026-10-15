import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/instrument-sans";
import Header from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vidéo IA – Créez des vidéos avec l'intelligence artificielle",
  description:
    "Générez une vidéo à partir d'un texte ou animez une image. Formats TikTok, YouTube et Instagram, styles cinéma, réaliste ou anime.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Appliqué avant l'affichage pour éviter un flash : clair par défaut, sombre si choisi.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
