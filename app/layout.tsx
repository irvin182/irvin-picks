// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import ActivityTracker from "@/components/ActivityTracker";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";

export const metadata: Metadata = {
  metadataBase: new URL("https://irvinanalytics.com"),
  title: "Irvin Analytics | Predicciones deportivas con IA",
  description:
    "Plataforma privada de análisis deportivo con inteligencia artificial. Estadísticas en vivo, probabilidades avanzadas, momentum y reportes premium.",

  manifest: "/manifest.json",

  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },

  openGraph: {
    title: "Irvin Analytics",
    description:
      "Predicciones deportivas, estadísticas en vivo y análisis con inteligencia artificial.",
    url: "https://irvinanalytics.com",
    siteName: "Irvin Analytics",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Irvin Analytics - Análisis deportivo con IA",
      },
    ],
    locale: "es_ES",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Irvin Analytics",
    description:
      "Predicciones deportivas, estadísticas en vivo y análisis con inteligencia artificial.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
     <body>
  <ActivityTracker />
  <LanguageSwitcher />
  {children}
</body>
    </html>
  );
}