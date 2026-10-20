"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, Moon, Sun, ClipboardList, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { routesFor } from "@/lib/nav";
import { useMe } from "@/hooks/use-me";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

type CommandItem = {
  id: string;
  label: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
  keywords?: string[];
};

export function CommandPalette() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const navigate = useCallback((href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  }, [router]);

  // Pages come from the single nav map, filtered by the user's puesto.
  const me = useMe();
  const pages = routesFor(me?.jobRole ?? null, me?.role === "ADMIN");

  const commands: CommandItem[] = [
    ...pages.map((r) => ({
      id: r.href,
      label: r.name,
      subtitle: r.group,
      icon: <r.icon className="h-4 w-4" />,
      action: () => navigate(r.href),
      category: "Ir a",
      keywords: r.keywords,
    })),
    {
      id: "daily-report",
      label: "Enviar mi reporte diario",
      icon: <ClipboardList className="h-4 w-4 text-primary" />,
      action: () => navigate("/dashboard/reportes"),
      category: "Acciones",
      keywords: ["reporte", "diario"],
    },
    {
      id: "theme",
      label: theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro",
      subtitle: `Actualmente: ${theme === "dark" ? "oscuro" : theme === "light" ? "claro" : "sistema"}`,
      icon: theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
      action: () => { setTheme(theme === "dark" ? "light" : "dark"); setOpen(false); },
      category: "Acciones",
      keywords: ["dark", "light", "oscuro", "claro", "tema"],
    },
    {
      id: "logout",
      label: "Cerrar sesión",
      icon: <LogOut className="h-4 w-4" />,
      action: () => signOut({ callbackUrl: "/login" }),
      category: "Acciones",
      keywords: ["salir", "logout"],
    },
  ];

  const filtered = query.trim().length === 0
    ? commands
    : commands.filter((c) => {
        const q = query.toLowerCase();
        return (
          c.label.toLowerCase().includes(q) ||
          c.subtitle?.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.keywords?.some((k) => k.toLowerCase().includes(q))
        );
      });

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {});

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setSelected(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => { setSelected(0); }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter") { e.preventDefault(); filtered[selected]?.action(); }
  };

  if (!open) return null;

  let itemIndex = -1;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
        <div role="dialog" aria-modal="true" aria-label="Paleta de comandos" className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Buscar páginas y acciones"
              placeholder="Buscar páginas y acciones..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <kbd className="shrink-0 rounded border border-border bg-secondary/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">ESC</kbd>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{category}</p>
                {items.map((item) => {
                  itemIndex++;
                  const idx = itemIndex;
                  return (
                    <button
                      key={item.id}
                      onMouseEnter={() => setSelected(idx)}
                      onClick={item.action}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        selected === idx ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      )}
                    >
                      <div className={cn("shrink-0", selected === idx ? "text-primary" : "")}>{item.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                        {item.subtitle && <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>}
                      </div>
                      {selected === idx && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">Sin resultados para &quot;{query}&quot;</p>
              </div>
            )}
          </div>

          <div className="border-t border-border px-4 py-2 flex items-center gap-4">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <kbd className="rounded border border-border bg-secondary/50 px-1.5 py-0.5 font-mono">↑↓</kbd> navegar
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <kbd className="rounded border border-border bg-secondary/50 px-1.5 py-0.5 font-mono">↵</kbd> abrir
            </span>
            <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
              <kbd className="rounded border border-border bg-secondary/50 px-1.5 py-0.5 font-mono">⌘K</kbd> para abrir
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
