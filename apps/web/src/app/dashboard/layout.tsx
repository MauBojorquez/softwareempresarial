"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { ShortcutsHelp } from "@/components/dashboard/shortcuts-help";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/toast";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useKeyboardShortcuts();

  return (
    <ThemeProvider>
      <ToastProvider>
      <ShortcutsHelp />
      <div className="flex h-screen bg-background">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            <Breadcrumb />
            {children}
          </main>
        </div>
      </div>
      </ToastProvider>
    </ThemeProvider>
  );
}
