"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Sparkles, Menu, FileText, BarChart3, Moon, Sun, Command } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { NotificationBell } from "@/components/notifications";

type SearchResult = {
  type: "metric" | "report";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  category: string;
};

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { data: session } = useSession();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const initials = session?.user?.name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "MP";
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    fetch("/api/user").then((r) => r.json()).then((d) => {
      if (d.user?.avatar) setUserAvatar(d.user.avatar);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearch = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    if (value.trim().length < 2) { setResults([]); setShowResults(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`);
        const data = await res.json();
        setResults(data.results || []);
        setShowResults(true);
      } catch { setResults([]); }
      setSearching(false);
    }, 300);
  };

  const navigate = (href: string) => {
    setShowResults(false);
    setQuery("");
    router.push(href);
  };

  const categoryLabel: Record<string, string> = {
    FINANCE: "Finanzas", SALES: "Ventas", OPERATIONS: "Operaciones", HR: "RRHH", MARKETING: "Marketing", REPORTS: "Reportes",
  };

  return (
    <header className="relative z-30 flex h-14 items-center justify-between border-b border-border bg-card/70 backdrop-blur-md px-4 sm:h-16 sm:px-6">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="flex items-center gap-3">
        <button aria-label="Menú" onClick={onMenuClick} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground lg:hidden">
          <Menu className="h-5 w-5" />
        </button>
        <div ref={ref} className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            aria-label="Buscar métricas y reportes"
            placeholder="Buscar métricas, reportes..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            className="h-9 w-56 rounded-lg border border-border bg-secondary/50 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors md:w-72"
          />
          {showResults && (
            <div className="absolute left-0 top-full mt-1.5 z-50 w-80 max-h-80 overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
              {searching ? (
                <div className="p-4 text-center text-xs text-muted-foreground">Buscando...</div>
              ) : results.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">Sin resultados para &quot;{query}&quot;</div>
              ) : (
                results.map((r) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() => navigate(r.href)}
                    className="w-full text-left flex items-start gap-3 px-3 py-2.5 hover:bg-secondary/50 transition-colors border-b border-border last:border-0"
                  >
                    <div className="mt-0.5 rounded-md bg-secondary p-1.5">
                      {r.type === "report" ? <FileText className="h-3.5 w-3.5 text-primary" /> : <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{r.subtitle}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{categoryLabel[r.category] || r.category}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Cambiar tema"
          className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          onClick={() => { const e = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }); document.dispatchEvent(e); }}
          aria-label="Paleta de comandos"
          title="Paleta de comandos (⌘K)"
          className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-2 text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
        >
          <Command className="h-4 w-4" />
          <kbd className="text-[10px] font-mono">⌘K</kbd>
        </button>
        <a
          href="/dashboard/reports"
          className="flex items-center gap-1.5 rounded-lg gradient-bg px-2.5 py-1.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90 sm:px-3 sm:text-xs"
        >
          <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          <span className="hidden xs:inline sm:inline">Reporte IA</span>
        </a>
        <NotificationBell />
        <a href="/dashboard/settings" className="h-7 w-7 rounded-full overflow-hidden flex items-center justify-center sm:h-8 sm:w-8 border border-border" aria-label="Configuración de perfil">
          {userAvatar ? (
            <img src={userAvatar} alt="Perfil" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] font-semibold text-primary sm:text-xs bg-primary/10 w-full h-full flex items-center justify-center">{initials}</span>
          )}
        </a>
      </div>
    </header>
  );
}
