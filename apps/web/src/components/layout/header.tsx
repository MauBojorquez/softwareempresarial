"use client";

import { Bell, Search, Sparkles } from "lucide-react";

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar métricas..."
            className="h-9 w-72 rounded-lg border border-border bg-secondary/50 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 rounded-lg gradient-bg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90">
          <Sparkles className="h-3.5 w-3.5" />
          Generar Reporte IA
        </button>
        <button className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
        </button>
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-xs font-semibold text-primary">MB</span>
        </div>
      </div>
    </header>
  );
}
