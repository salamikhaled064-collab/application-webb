import type { Metadata } from "next";
import Header from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Video – Génération de vidéos par IA",
  description:
    "Transformez une image et un prompt en vidéo animée grâce à l'intelligence artificielle. Formats TikTok, YouTube, styles cinématiques et plus.",
  keywords: ["IA", "vidéo", "génération", "image to video", "Agnes AI"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
