"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Header } from "@/components/layout/header";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { ShortcutsHelp } from "@/components/dashboard/shortcuts-help";
import { CommandPalette } from "@/components/command-palette";
import { ActivityTracker } from "@/components/dashboard/activity-tracker";
import { PWARegister } from "@/components/pwa-register";
import { ThemeProvider } from "@/components/theme-provider";
import { BrandProvider } from "@/components/brand-provider";
import { ToastProvider } from "@/components/toast";
import { ConfirmProvider } from "@/components/ui/confirm";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { routeFor } from "@/lib/nav";


const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  useKeyboardShortcuts();

  useEffect(() => {
    const route = routeFor(pathname);
    document.title = route ? `${route.name} · StratiuMetrics` : "StratiuMetrics";
  }, [pathname]);

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
      <ConfirmProvider>
      <ShortcutsHelp />
      <CommandPalette />
      <ActivityTracker />
      <PWARegister />
      <a href="#main-content" className="skip-link">Ir al contenido principal</a>
      <div className="relative flex h-screen bg-background">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main id="main-content" className="flex-1 overflow-auto p-4 pb-24 sm:p-6 sm:pb-6 lg:pb-6">
            <Breadcrumb />
            {children}
          </main>
        </div>
        <BottomNav onMenuClick={() => setSidebarOpen(true)} />
      </div>
      </ConfirmProvider>
      </ToastProvider>
      </BrandProvider>
    </ThemeProvider>
  );
}
