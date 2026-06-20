"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { ShortcutsHelp } from "@/components/dashboard/shortcuts-help";
import { CommandPalette } from "@/components/command-palette";
import { ActivityTracker } from "@/components/dashboard/activity-tracker";
import { GuidedTour } from "@/components/dashboard/guided-tour";
import { PWARegister } from "@/components/pwa-register";
import { ThemeProvider } from "@/components/theme-provider";
import { BrandProvider } from "@/components/brand-provider";
import { ToastProvider } from "@/components/toast";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard/overview": "Dashboard",
  "/dashboard/goals": "Metas",
  "/dashboard/finance": "Finanzas",
  "/dashboard/sales": "Ventas",
  "/dashboard/operations": "Operaciones",
  "/dashboard/hr": "RRHH",
  "/dashboard/marketing": "Marketing",
  "/dashboard/reports": "Reportes IA",
  "/dashboard/team": "Equipo",
  "/dashboard/integrations": "Integraciones",
  "/dashboard/billing": "Suscripción",
  "/dashboard/settings": "Configuración",
};

const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  useKeyboardShortcuts();

  useEffect(() => {
    const match = Object.entries(PAGE_TITLES).find(([k]) => pathname.startsWith(k));
    document.title = match ? `${match[1]} | StratiuMetrics` : "StratiuMetrics";
  }, [pathname]);

  // Let the guided tour reveal the sidebar on mobile while it runs.
  useEffect(() => {
    const open = () => setSidebarOpen(true);
    const close = () => setSidebarOpen(false);
    window.addEventListener("stratiumetrics:open-sidebar", open);
    window.addEventListener("stratiumetrics:close-sidebar", close);
    return () => {
      window.removeEventListener("stratiumetrics:open-sidebar", open);
      window.removeEventListener("stratiumetrics:close-sidebar", close);
    };
  }, []);

  useEffect(() => {
    const last = parseInt(localStorage.getItem("metrixpro-last-autosync") ?? "0", 10);
    if (Date.now() - last > AUTO_SYNC_INTERVAL_MS) {
      // Fire-and-forget: sync all connected integrations in the background
      fetch("/api/integrations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ALL" }),
      }).catch(() => {});
      localStorage.setItem("metrixpro-last-autosync", Date.now().toString());
    }
  }, []);

  return (
    <ThemeProvider>
      <BrandProvider>
      <ToastProvider>
      <ShortcutsHelp />
      <CommandPalette />
      <ActivityTracker />
      <GuidedTour />
      <PWARegister />
      <a href="#main-content" className="skip-link">Ir al contenido principal</a>
      <div className="relative flex h-screen bg-background">
        {/* Stripe-style flowing gradient backdrop */}
        <div className="mesh-bg" aria-hidden />
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main id="main-content" className="flex-1 overflow-auto p-4 sm:p-6">
            <Breadcrumb />
            {children}
          </main>
        </div>
      </div>
      </ToastProvider>
      </BrandProvider>
    </ThemeProvider>
  );
}
