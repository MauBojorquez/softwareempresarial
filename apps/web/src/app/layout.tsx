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
    statusBarStyle: "black-translucent",
    title: "StratiuMetrics",
    startupImage: [{ url: "/brand-icon.png" }],
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
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#08090F" },
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
        {/* Self-heal from stale-Service-Worker ChunkLoadError reload-loops.
            When a new deploy changes chunk hashes, an old cache-first SW can
            serve stale chunks → ChunkLoadError → the app reloads itself over
            and over. On the first chunk failure we nuke every SW + cache and
            reload exactly once (guarded by sessionStorage) to recover. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function heal(){try{if(sessionStorage.getItem('sw-healed'))return;sessionStorage.setItem('sw-healed','1');if(window.caches&&caches.keys){caches.keys().then(function(ks){ks.forEach(function(k){caches.delete(k)})})}if(navigator.serviceWorker&&navigator.serviceWorker.getRegistrations){navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister()})}).finally(function(){location.reload()})}else{location.reload()}}catch(e){try{location.reload()}catch(_){}}}function isChunkErr(m){return m&&(/ChunkLoadError/i.test(m)||/Loading chunk [\\d]+ failed/i.test(m)||/Loading CSS chunk/i.test(m)||/error loading dynamically imported module/i.test(m))}window.addEventListener('error',function(e){if(isChunkErr(e&&e.message)||(e&&e.error&&isChunkErr(e.error.message)))heal()});window.addEventListener('unhandledrejection',function(e){var r=e&&e.reason;if(r&&isChunkErr(typeof r==='string'?r:r.message))heal()});})();`,
          }}
        />
      </head>
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
