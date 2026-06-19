"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { ShortcutsHelp } from "@/components/dashboard/shortcuts-help";
import { ThemeProvider } from "@/components/theme-provider";
import { BrandProvider } from "@/components/brand-provider";
import { ToastProvider } from "@/components/toast";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useKeyboardShortcuts();

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
      <div className="relative flex h-screen bg-background">
        {/* Stripe-style flowing gradient backdrop */}
        <div className="mesh-bg" aria-hidden />
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-auto p-4 sm:p-6">
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
