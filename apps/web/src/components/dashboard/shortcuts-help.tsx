"use client";

import { useEffect, useState } from "react";
import { X, Keyboard } from "lucide-react";

const shortcuts = [
  { key: "G", label: "Dashboard / Resumen" },
  { key: "F", label: "Finanzas" },
  { key: "V", label: "Ventas" },
  { key: "O", label: "Operaciones" },
  { key: "H", label: "Recursos Humanos" },
  { key: "M", label: "Marketing" },
  { key: "R", label: "Reportes" },
  { key: "S", label: "Configuración" },
  { key: "?", label: "Mostrar atajos" },
];

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen((prev) => !prev);
    window.addEventListener("toggle-shortcuts-help", handler);
    return () => window.removeEventListener("toggle-shortcuts-help", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setOpen(false)} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
        <div role="dialog" aria-modal="true" aria-label="Atajos de teclado" className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Atajos de Teclado</h3>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2">
            {shortcuts.map((s) => (
              <div key={s.key} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{s.label}</span>
                <kbd className="rounded border border-border bg-secondary/50 px-2 py-0.5 text-xs font-mono font-medium">{s.key}</kbd>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground text-center">
            Presiona <kbd className="rounded border border-border bg-secondary/50 px-1.5 py-0.5 text-[10px] font-mono">?</kbd> para mostrar/ocultar
          </p>
        </div>
      </div>
    </>
  );
}
