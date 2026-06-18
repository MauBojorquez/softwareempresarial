"use client";

import { Search, Sparkles, Menu } from "lucide-react";
import { NotificationBell } from "@/components/notifications";

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 sm:h-16 sm:px-6">
      <div className="flex items-center gap-3">
        <button aria-label="Menú" onClick={onMenuClick} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground lg:hidden">
          <Menu className="h-5 w-5" />
        </button>
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar métricas..."
            className="h-9 w-56 rounded-lg border border-border bg-secondary/50 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors md:w-72"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <a
          href="/dashboard/reports"
          className="flex items-center gap-1.5 rounded-lg gradient-bg px-2.5 py-1.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90 sm:px-3 sm:text-xs"
        >
          <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          <span className="hidden xs:inline sm:inline">Reporte IA</span>
        </a>
        <NotificationBell />
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center sm:h-8 sm:w-8">
          <span className="text-[10px] font-semibold text-primary sm:text-xs">MB</span>
        </div>
      </div>
    </header>
  );
}
