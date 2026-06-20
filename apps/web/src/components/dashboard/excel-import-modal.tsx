"use client";

import { useState, useRef } from "react";
import { X, FileSpreadsheet, ArrowRight, ArrowLeft, Loader2, Check, Upload, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast";
import {
  CATEGORY_TEMPLATES, CATEGORY_LABELS, ALL_CATEGORIES, type MetricCategoryKey,
} from "@/lib/metric-templates";

type Cell = string | number | Date;
type SheetData = { name: string; rows: Cell[][] };
type ColumnMapping = { target: string; unit: string }; // target: "" = ignore, "__date__" = date, else metric name

const DATE_TARGET = "__date__";
const IGNORE_TARGET = "";

export function ExcelImportModal({
  open,
  onClose,
  onImported,
  defaultCategory,
}: {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
  defaultCategory?: MetricCategoryKey;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [category, setCategory] = useState<MetricCategoryKey>(defaultCategory ?? "FINANCE");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  // column index -> mapping
  const [mappings, setMappings] = useState<Record<number, ColumnMapping>>({});

  const reset = () => {
    setStep(1); setFileName(""); setSheets([]); setActiveSheet(0);
    setMappings({}); setParsing(false); setImporting(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const parsed: SheetData[] = wb.SheetNames.map((name) => {
        const ws = wb.Sheets[name];
        const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, blankrows: false, defval: "" });
        return { name, rows: rows.slice(0, 1000) };
      }).filter((s) => s.rows.length > 0);

      if (parsed.length === 0) {
        toast("El archivo no tiene datos legibles", "error");
        setParsing(false);
        return;
      }
      setFileName(file.name);
      setSheets(parsed);
      setActiveSheet(0);
      setMappings({});
      setStep(2);
    } catch {
      toast("No se pudo leer el archivo. ¿Es un Excel válido (.xlsx)?", "error");
    }
    setParsing(false);
  };

  const sheet = sheets[activeSheet];
  const headers = sheet?.rows[0] ?? [];
  const dataRows = sheet?.rows.slice(1) ?? [];

  // Auto-guess mappings when entering the mapping step for a sheet
  const initMappingsForSheet = (idx: number) => {
    const s = sheets[idx];
    if (!s) return;
    const hdrs = s.rows[0] ?? [];
    const templates = CATEGORY_TEMPLATES[category];
    const next: Record<number, ColumnMapping> = {};
    hdrs.forEach((h, i) => {
      const label = String(h).toLowerCase().trim();
      if (/fecha|mes|periodo|período|date|day|día/.test(label)) {
        next[i] = { target: DATE_TARGET, unit: "" };
        return;
      }
      // try to match a template by name
      const match = templates.find((t) =>
        label && (t.name.toLowerCase().includes(label) || label.includes(t.name.toLowerCase().split(" ")[0]))
      );
      next[i] = match ? { target: match.name, unit: match.unit } : { target: IGNORE_TARGET, unit: "" };
    });
    setMappings(next);
  };

  const goToMapping = () => {
    initMappingsForSheet(activeSheet);
    setStep(3);
  };

  const setColTarget = (colIdx: number, target: string) => {
    const template = CATEGORY_TEMPLATES[category].find((t) => t.name === target);
    setMappings((prev) => ({ ...prev, [colIdx]: { target, unit: template?.unit ?? prev[colIdx]?.unit ?? "" } }));
  };

  const dateColIdx = Object.entries(mappings).find(([, m]) => m.target === DATE_TARGET)?.[0];
  const mappedValueCols = Object.entries(mappings).filter(([, m]) => m.target && m.target !== DATE_TARGET);

  // Build entries from the current mapping for preview/import
  const buildEntries = () => {
    const entries: { name: string; value: number; unit: string; period?: string }[] = [];
    for (const row of dataRows) {
      let period: string | undefined;
      if (dateColIdx !== undefined) {
        const raw = row[Number(dateColIdx)];
        if (raw instanceof Date) period = raw.toISOString();
        else if (raw) { const d = new Date(String(raw)); if (!isNaN(d.getTime())) period = d.toISOString(); }
      }
      for (const [colIdx, m] of mappedValueCols) {
        const raw = row[Number(colIdx)];
        if (raw === "" || raw === undefined || raw === null) continue;
        const value = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[$,\s]/g, ""));
        if (!Number.isFinite(value)) continue;
        entries.push({ name: m.target, value, unit: m.unit, period });
      }
    }
    return entries;
  };

  const previewEntries = step === 4 ? buildEntries() : [];

  const handleImport = async () => {
    const entries = buildEntries();
    if (entries.length === 0) {
      toast("No hay datos válidos con el mapeo actual", "error");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/metrics/excel/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, entries }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Error al importar", "error");
      } else {
        toast(`${data.imported} registros importados${data.skipped ? `, ${data.skipped} omitidos` : ""}`, "success");
        onImported?.();
        handleClose();
      }
    } catch {
      toast("Error de conexión", "error");
    }
    setImporting(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Importar desde Excel</h2>
              <p className="text-xs text-muted-foreground">Paso {step} de 4</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {/* Progress */}
        <div className="flex gap-1 px-4 pt-3 sm:px-5">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={cn("h-1 flex-1 rounded-full transition-colors", s <= step ? "bg-primary" : "bg-secondary")} />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* Step 1 — Upload */}
          {step === 1 && (
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border py-16 text-center cursor-pointer hover:border-primary/40 hover:bg-secondary/30 transition-colors"
            >
              {parsing ? (
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <Upload className="h-7 w-7 text-primary" />
                </div>
              )}
              <p className="text-sm font-medium">{parsing ? "Leyendo archivo..." : "Arrastra tu Excel o haz clic para elegir"}</p>
              <p className="text-xs text-muted-foreground">Formato .xlsx o .xls — máximo 1,000 filas por hoja</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
              />
            </div>
          )}

          {/* Step 2 — Pick sheet + category */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span className="font-medium truncate">{fileName}</span>
              </div>

              <div>
                <label className="text-sm font-medium">¿Qué hoja quieres importar?</label>
                <p className="text-xs text-muted-foreground mb-2">Tu archivo tiene {sheets.length} hoja{sheets.length > 1 ? "s" : ""}.</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {sheets.map((s, i) => (
                    <button
                      key={s.name}
                      onClick={() => setActiveSheet(i)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-sm transition-all",
                        activeSheet === i ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/40"
                      )}
                    >
                      <p className="font-medium truncate">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground">{Math.max(0, s.rows.length - 1)} filas</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">¿A qué sección pertenece esta hoja?</label>
                <p className="text-xs text-muted-foreground mb-2">Los datos se guardarán en esta sección del software.</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        category === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      {CATEGORY_LABELS[c]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Map columns */}
          {step === 3 && sheet && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground">
                <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Conecta cada columna de tu Excel con un campo del software. Elige <b>Fecha</b> en la columna de períodos, y asigna las columnas de valores a su métrica. Lo que no uses, déjalo en <b>Ignorar</b>.</span>
              </div>

              <div className="space-y-2">
                {headers.map((h, i) => {
                  const sample = dataRows.find((r) => r[i] !== "" && r[i] !== undefined)?.[i];
                  const m = mappings[i] ?? { target: IGNORE_TARGET, unit: "" };
                  return (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-border p-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{String(h) || `Columna ${i + 1}`}</p>
                        {sample !== undefined && <p className="text-[11px] text-muted-foreground truncate">Ej: {String(sample)}</p>}
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <select
                        value={m.target}
                        onChange={(e) => setColTarget(i, e.target.value)}
                        className={cn(
                          "rounded-lg border bg-background px-2.5 py-1.5 text-xs font-medium shrink-0 w-40",
                          m.target === IGNORE_TARGET ? "border-border text-muted-foreground" : "border-primary/40 text-foreground"
                        )}
                      >
                        <option value={IGNORE_TARGET}>Ignorar</option>
                        <option value={DATE_TARGET}>📅 Fecha / Período</option>
                        <optgroup label={CATEGORY_LABELS[category]}>
                          {CATEGORY_TEMPLATES[category].map((t) => (
                            <option key={t.name} value={t.name}>{t.name}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  );
                })}
              </div>

              {mappedValueCols.length === 0 && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> Asigna al menos una columna a una métrica para continuar.
                </p>
              )}
            </div>
          )}

          {/* Step 4 — Preview */}
          {step === 4 && (
            <div className="space-y-3">
              <p className="text-sm">
                Se importarán <b className="text-primary">{previewEntries.length}</b> registros a <b>{CATEGORY_LABELS[category]}</b>.
              </p>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/50 text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left font-medium">Métrica</th>
                      <th className="p-2 text-right font-medium">Valor</th>
                      <th className="p-2 text-left font-medium">Período</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewEntries.slice(0, 8).map((e, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-2">{e.name}</td>
                        <td className="p-2 text-right font-medium">{e.value.toLocaleString("es-MX")} {e.unit}</td>
                        <td className="p-2 text-muted-foreground">{e.period ? new Date(e.period).toLocaleDateString("es-MX") : "Hoy"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewEntries.length > 8 && (
                  <p className="bg-secondary/30 p-2 text-center text-[11px] text-muted-foreground">+ {previewEntries.length - 8} registros más</p>
                )}
              </div>
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

          {step === 2 && (
            <button onClick={goToMapping} className="flex items-center gap-1.5 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              Mapear columnas <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
          {step === 3 && (
            <button
              onClick={() => setStep(4)}
              disabled={mappedValueCols.length === 0}
              className="flex items-center gap-1.5 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Ver resultado <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
          {step === 4 && (
            <button
              onClick={handleImport}
              disabled={importing || previewEntries.length === 0}
              className="flex items-center gap-1.5 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {importing ? "Importando..." : `Importar ${previewEntries.length}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
