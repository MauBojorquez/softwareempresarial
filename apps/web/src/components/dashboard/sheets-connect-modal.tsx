"use client";

import { useState, useEffect } from "react";
import { X, Loader2, ArrowRight, ArrowLeft, Check, Link2, Trash2, Table2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { colLetter, parseCellNumber } from "@/lib/google-sheets";
import {
  CATEGORY_TEMPLATES, CATEGORY_LABELS, ALL_CATEGORIES, type MetricCategoryKey,
} from "@/lib/metric-templates";

type Mapping = { row: number; col: number; category: MetricCategoryKey; name: string; unit: string };

export function SheetsConnectModal({
  open,
  onClose,
  onConnected,
}: {
  open: boolean;
  onClose: () => void;
  onConnected?: () => void;
}) {
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [url, setUrl] = useState("");
  const [grid, setGrid] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [sel, setSel] = useState<{ row: number; col: number } | null>(null);
  const [selCategory, setSelCategory] = useState<MetricCategoryKey>("FINANCE");
  const [selMetric, setSelMetric] = useState<string>(CATEGORY_TEMPLATES.FINANCE[0].name);

  // Load existing connection when opened
  useEffect(() => {
    if (!open) return;
    fetch("/api/integrations/sheets")
      .then((r) => r.json())
      .then((d) => {
        if (d.connected) {
          setUrl(d.url ?? "");
          setMappings(Array.isArray(d.mappings) ? d.mappings : []);
        }
      })
      .catch(() => {});
  }, [open]);

  const reset = () => {
    setStep(1); setUrl(""); setGrid([]); setMappings([]); setSel(null);
    setLoading(false); setConnecting(false);
  };
  const handleClose = () => { reset(); onClose(); };

  const loadPreview = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/sheets/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "No se pudo leer la hoja", "error"); setLoading(false); return; }
      setGrid(data.grid ?? []);
      setStep(2);
    } catch {
      toast("Error de conexión", "error");
    }
    setLoading(false);
  };

  const selectCell = (row: number, col: number) => {
    setSel({ row, col });
    // If the cell is already mapped, prefill its assignment
    const existing = mappings.find((m) => m.row === row && m.col === col);
    if (existing) { setSelCategory(existing.category); setSelMetric(existing.name); }
  };

  const addMapping = () => {
    if (!sel) return;
    const unit = CATEGORY_TEMPLATES[selCategory].find((t) => t.name === selMetric)?.unit ?? "";
    setMappings((prev) => [
      ...prev.filter((m) => !(m.row === sel.row && m.col === sel.col)),
      { row: sel.row, col: sel.col, category: selCategory, name: selMetric, unit },
    ]);
    setSel(null);
    toast(`${colLetter(sel.col)}${sel.row + 1} → ${selMetric}`, "success");
  };

  const removeMapping = (row: number, col: number) =>
    setMappings((prev) => prev.filter((m) => !(m.row === row && m.col === col)));

  const handleConnect = async () => {
    if (mappings.length === 0) { toast("Agrega al menos un mapeo", "error"); return; }
    setConnecting(true);
    try {
      const res = await fetch("/api/integrations/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, mappings }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "Error al conectar", "error"); setConnecting(false); return; }
      toast(`Conectado — ${data.synced} datos sincronizados`, "success");
      onConnected?.();
      handleClose();
    } catch {
      toast("Error de conexión", "error");
    }
    setConnecting(false);
  };

  if (!open) return null;

  const mapAt = (r: number, c: number) => mappings.find((m) => m.row === r && m.col === c);
  const maxCols = Math.min(26, Math.max(...grid.map((r) => r.length), 1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <Table2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Conectar hoja de cálculo</h2>
              <p className="text-xs text-muted-foreground">Paso {step} de 2 · se actualiza en vivo</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* Step 1 — URL */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 text-xs text-muted-foreground space-y-1.5">
                <p className="font-medium text-foreground">Conecta tu Excel a través de Google Sheets</p>
                <p>1. Sube tu Excel a Google Drive (se convierte en Sheets) o abre tu hoja en Google Sheets.</p>
                <p>2. En <b>Compartir</b>, elige <b>&quot;Cualquier persona con el enlace&quot;</b> como Lector.</p>
                <p>3. Copia el enlace y pégalo aquí. Cuando cambies la hoja, el software se actualiza solo.</p>
              </div>
              <div>
                <label className="text-sm font-medium">Enlace de Google Sheets</label>
                <div className="relative mt-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Cell mapping */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground">
                Haz clic en la <b>celda exacta</b> que quieres traer (ej. el número de ventas), elige a qué métrica corresponde y agrégala. Las celdas mapeadas se marcan en verde.
              </div>

              {/* Spreadsheet grid */}
              <div className="overflow-auto rounded-lg border border-border max-h-[40vh]">
                <table className="border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="sticky top-0 left-0 z-20 bg-secondary w-10 border border-border" />
                      {Array.from({ length: maxCols }).map((_, c) => (
                        <th key={c} className="sticky top-0 z-10 bg-secondary border border-border px-2 py-1 font-medium text-muted-foreground min-w-[80px]">{colLetter(c)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grid.map((row, r) => (
                      <tr key={r}>
                        <td className="sticky left-0 z-10 bg-secondary border border-border px-2 py-1 text-center font-medium text-muted-foreground">{r + 1}</td>
                        {Array.from({ length: maxCols }).map((_, c) => {
                          const val = row[c] ?? "";
                          const mapped = mapAt(r, c);
                          const isSel = sel?.row === r && sel?.col === c;
                          return (
                            <td
                              key={c}
                              onClick={() => selectCell(r, c)}
                              title={mapped ? `${mapped.name}` : undefined}
                              className={cn(
                                "border border-border px-2 py-1 cursor-pointer whitespace-nowrap max-w-[160px] truncate",
                                isSel && "ring-2 ring-primary ring-inset bg-primary/10",
                                mapped && !isSel && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium",
                                !mapped && !isSel && "hover:bg-secondary/60"
                              )}
                            >
                              {String(val)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Assignment panel for selected cell */}
              {sel && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="rounded bg-primary/15 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                      Celda {colLetter(sel.col)}{sel.row + 1}
                    </span>
                    <span className="text-muted-foreground">=</span>
                    <span className="font-medium">{String(grid[sel.row]?.[sel.col] ?? "")}</span>
                    {parseCellNumber(grid[sel.row]?.[sel.col]) === null && (
                      <span className="text-[11px] text-amber-600">(no parece un número)</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selCategory}
                      onChange={(e) => {
                        const c = e.target.value as MetricCategoryKey;
                        setSelCategory(c);
                        setSelMetric(CATEGORY_TEMPLATES[c][0].name);
                      }}
                      className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium"
                    >
                      {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                    </select>
                    <select
                      value={selMetric}
                      onChange={(e) => setSelMetric(e.target.value)}
                      className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium flex-1 min-w-[140px]"
                    >
                      {CATEGORY_TEMPLATES[selCategory].map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                    </select>
                    <button onClick={addMapping} className="flex items-center gap-1 rounded-lg gradient-bg px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
                      <Check className="h-3.5 w-3.5" /> Mapear
                    </button>
                  </div>
                </div>
              )}

              {/* Current mappings */}
              {mappings.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Celdas mapeadas ({mappings.length})</p>
                  <div className="space-y-1">
                    {mappings.map((m) => (
                      <div key={`${m.row}-${m.col}`} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs">
                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono font-semibold text-emerald-600">{colLetter(m.col)}{m.row + 1}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{m.name}</span>
                        <span className="text-muted-foreground">· {CATEGORY_LABELS[m.category]}</span>
                        <button onClick={() => removeMapping(m.row, m.col)} className="ml-auto text-muted-foreground hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border p-4 sm:p-5">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : handleClose()}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {step > 1 ? "Atrás" : "Cancelar"}
          </button>
          {step === 1 && (
            <button onClick={loadPreview} disabled={loading || !url.trim()} className="flex items-center gap-1.5 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {loading ? "Leyendo..." : "Leer hoja"}
            </button>
          )}
          {step === 2 && (
            <button onClick={handleConnect} disabled={connecting || mappings.length === 0} className="flex items-center gap-1.5 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {connecting ? "Conectando..." : `Conectar (${mappings.length})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
