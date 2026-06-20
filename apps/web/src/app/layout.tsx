import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: {
    default: "StratiuMetrics — Dashboard Empresarial con IA",
    template: "%s | StratiuMetrics",
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
  applicationName: "StratiuMetrics",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "StratiuMetrics",
  },
  formatDetection: { telephone: false },
  icons: [
    { rel: "icon", url: "/brand-icon.png", type: "image/png" },
    { rel: "apple-touch-icon", url: "/brand-icon.png" },
  ],
  openGraph: {
    title: "StratiuMetrics — Dashboard Empresarial con IA",
    description:
      "Centraliza las métricas de tu empresa con inteligencia artificial.",
    type: "website",
    locale: "es_MX",
    siteName: "StratiuMetrics",
  },
  twitter: {
    card: "summary_large_image",
    title: "StratiuMetrics — Dashboard Empresarial con IA",
    description: "Centraliza las métricas de tu empresa. Finanzas, ventas, operaciones, RH y marketing en un solo lugar.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#171a1f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Apply the theme before paint so every page (landing, login,
            dashboard) respects the stored choice or the OS preference,
            with no flash of the wrong theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('metrixpro-theme');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
      </head>
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
