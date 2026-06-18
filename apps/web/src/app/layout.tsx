import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: {
    default: "MetrixPro — Dashboard Empresarial con IA",
    template: "%s | MetrixPro",
  },
  description:
    "Centraliza las métricas de tu empresa. Finanzas, ventas, operaciones, RH y marketing en un solo lugar con reportes inteligentes.",
  keywords: [
    "dashboard empresarial",
    "métricas",
    "KPIs",
    "IA",
    "reportes",
    "finanzas",
    "ventas",
    "México",
  ],
  authors: [{ name: "Stratium" }],
  manifest: "/manifest.json",
  icons: [
    { rel: "icon", url: "/favicon.svg", type: "image/svg+xml" },
  ],
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#171a1f" },
  ],
  openGraph: {
    title: "MetrixPro — Dashboard Empresarial con IA",
    description:
      "Centraliza las métricas de tu empresa con inteligencia artificial.",
    type: "website",
    locale: "es_MX",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
