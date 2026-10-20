"use client";

import { useEffect, useState } from "react";
import { type LucideIcon } from "lucide-react";
import { Plus, Trash2, Download, Upload, Search, RefreshCw, LinkIcon, Pencil, ArrowLeftRight, SearchX } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ExportButton } from "@/components/dashboard/export-button";
import { cn, formatCurrency } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import { PageHeader, Card } from "@/components/ui/page-header";
import { EmptyState, ErrorState, CardsSkeleton, RowsSkeleton, Skeleton } from "@/components/ui/states";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/toast";
import { addActivityLog } from "@/components/dashboard/activity-log";

export type { MetricTemplate } from "@/lib/metric-templates";
import { evalFormula } from "@/lib/metric-templates";
import type { MetricTemplate } from "@/lib/metric-templates";
type MetricEntry = { id: string; name: string; value: number; unit: string | null; period: string };
type CompareData = { current: MetricEntry[]; previous: MetricEntry[] } | null;

const fmtValue = (v: number, unit: string | null) =>
  unit === "MXN" ? formatCurrency(v) : `${v.toLocaleString("es-MX")} ${unit || ""}`;

export interface MetricsDashboardProps {
  title: string;
  subtitle: string;
  category: string;
  templates: MetricTemplate[];
  defaultSelected: string[];
  iconMap: Record<string, LucideIcon>;
  defaultIcon: LucideIcon;
  activityLabel: string;
  emptyTitle: string;
  emptySubtitle: string;
  /** Optional extra content rendered after metric cards */
  extraContent?: (metrics: MetricEntry[], months: number) => React.ReactNode;
  /** Hide the built-in title/subtitle header (use when parent renders its own) */
  hideTitle?: boolean;
  /**
   * When true, hides all manual data-entry affordances (add/edit/delete/import/
   * template) and renders records read-only. Used for FINANCE, which is fed
   * exclusively by SAT + the Cash Flow module.
   */
  disableManualEntry?: boolean;
  /** Message shown under the read-only data source note when manual entry is off. */
  readOnlyNote?: string;
}

export function MetricsDashboard({
  title,
  subtitle,
  category,
  templates,
  defaultSelected,
  iconMap,
  defaultIcon,
  activityLabel,
  emptyTitle,
  emptySubtitle,
  extraContent,
  hideTitle,
  disableManualEntry,
  readOnlyNote,
}: MetricsDashboardProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  // Remember the selected range across reloads (per category) so refreshing the
  // page returns the user to where they left off instead of snapping back to a
  // default. Read synchronously so there's no flicker / double-fetch on mount.
  const monthsKey = `metrixpro-months-${category}`;
  const [months, setMonthsState] = useState<number>(() => {
    if (typeof window === "undefined") return 3;
    const n = parseInt(window.localStorage.getItem(`metrixpro-months-${category}`) || "", 10);
    return [1, 3, 6, 12].includes(n) ? n : 3;
  });
  const setMonths = (m: number) => {
    setMonthsState(m);
    try { localStorage.setItem(monthsKey, String(m)); } catch { /* almacenamiento no disponible: solo se pierde la preferencia */ }
  };
  const [form, setForm] = useState({ name: templates[0].name, value: "", period: new Date().toISOString().split("T")[0] });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(defaultSelected);
  const [editEntry, setEditEntry] = useState<MetricEntry | null>(null);
  const [editForm, setEditForm] = useState({ value: "", period: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareData, setCompareData] = useState<CompareData>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  const storageKey = `metrixpro-display-${category}`;

  const load = (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    fetch(`/api/metrics/manual?category=${category}&months=${months}`, { signal })
      .then((r) => { if (!r.ok) throw new Error("Error al cargar datos"); return r.json(); })
      .then((d) => { setMetrics(d.metrics || []); setLoading(false); })
      .catch((e) => { if (e.name !== "AbortError") { setError(e.message); setLoading(false); } });
  };

  // Abort the previous request when `months` changes so a stale response
  // can't overwrite a newer one (race condition).
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [months]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => load(), 30000);
    return () => clearInterval(id);
  }, [autoRefresh, months]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setSelectedMetrics(JSON.parse(stored));
    } catch {
      // Preferencia local corrupta o almacenamiento bloqueado: se usan los valores por defecto.
    }
  }, []);

  useEffect(() => {
    if (!compareMode) { setCompareData(null); return; }
    const controller = new AbortController();
    setCompareLoading(true);
    fetch(`/api/metrics/compare?category=${category}&months=${months}`, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error("Error al cargar comparación"); return r.json(); })
      .then((d: CompareData) => { setCompareData(d); setCompareLoading(false); })
      .catch((e) => { if (e.name !== "AbortError") { toast("Error al cargar datos de comparación", "error"); setCompareLoading(false); } });
    return () => controller.abort();
  }, [compareMode, months, category]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", category);
      const res = await fetch("/api/metrics/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "No se pudo importar el archivo", "error");
      } else if (data.errors?.length > 0) {
        toast(`Importados: ${data.imported}/${data.total}. ${data.errors.length} errores.`, "error");
      } else {
        toast(`${data.imported} registros importados correctamente`, "success");
        addActivityLog("CSV importado", `${data.imported} registros en ${activityLabel}`, "import");
      }
      load();
    } catch {
      toast("Error de conexión al importar", "error");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!form.value) return;
    setSaving(true);
    const template = templates.find((t) => t.name === form.name);
    try {
      const res = await fetch("/api/metrics/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, name: form.name, value: parseFloat(form.value), unit: template?.unit || "", period: form.period }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast(d.error || "No se pudo guardar el dato", "error");
        setSaving(false);
        return;
      }
      addActivityLog("Métrica registrada", `${form.name}: ${form.value} en ${activityLabel}`, "add");
      toast("Dato guardado", "success");
      setShowForm(false);
      setForm({ name: templates[0].name, value: "", period: new Date().toISOString().split("T")[0] });
      load();
    } catch {
      toast("Error de conexión al guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: "Eliminar registro",
      description: "¿Eliminar este registro? Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar",
      destructive: true,
    }))) return;
    try {
      const res = await fetch(`/api/metrics/manual?id=${id}`, { method: "DELETE" });
      if (!res.ok) { toast("No se pudo eliminar el registro", "error"); return; }
      addActivityLog("Registro eliminado", activityLabel, "delete");
      toast("Registro eliminado", "success");
      load();
    } catch {
      toast("Error de conexión al eliminar", "error");
    }
  };

  const openEdit = (entry: MetricEntry) => {
    setEditEntry(entry);
    setEditForm({ value: String(entry.value), period: entry.period.slice(0, 10) });
  };

  const handleEdit = async () => {
    if (!editEntry || !editForm.value) return;
    setEditSaving(true);
    try {
      const res = await fetch("/api/metrics/manual", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editEntry.id, value: parseFloat(editForm.value), period: editForm.period }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast(d.error || "No se pudo actualizar el registro", "error");
        setEditSaving(false);
        return;
      }
      setEditEntry(null);
      load();
      toast("Registro actualizado", "success");
    } catch {
      toast("Error de conexión al actualizar", "error");
    } finally {
      setEditSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    const count = selected.size;
    if (!(await confirm({
      title: "Eliminar registros",
      description: `¿Eliminar ${count} registro${count > 1 ? "s" : ""}? Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
      destructive: true,
    }))) return;
    try {
      const results = await Promise.all(
        Array.from(selected).map((id) => fetch(`/api/metrics/manual?id=${id}`, { method: "DELETE" }).then((r) => r.ok).catch(() => false))
      );
      const failed = results.filter((ok) => !ok).length;
      if (failed > 0) toast(`No se pudieron eliminar ${failed} registro(s)`, "error");
      else toast("Registros eliminados", "success");
      load();
    } catch {
      toast("Error de conexión al eliminar", "error");
    } finally {
      setSelected(new Set());
    }
  };

  const formatFor = (unit: string | undefined) =>
    unit === "MXN" ? "currency" as const : unit === "%" ? "percentage" as const : "number" as const;

  // --- Number aggregation ---
  // Group raw entries by month key (YYYY-MM), sum within each month.
  const monthKey = (period: string) => period.slice(0, 7);

  const monthsWithData = (name: string) =>
    [...new Set(metrics.filter((m) => m.name === name).map((m) => monthKey(m.period)))].sort().reverse();

  /** Sum of all entries for a metric in a specific month (YYYY-MM). */
  const monthSum = (name: string, mk: string) =>
    metrics.filter((m) => m.name === name && monthKey(m.period) === mk).reduce((s, m) => s + m.value, 0);

  /** Sum for current month (most recent month that has data for this metric). */
  const rawLatest = (name: string) => {
    const mks = monthsWithData(name);
    return mks.length ? monthSum(name, mks[0]) : 0;
  };

  /** Sum for the previous month (second distinct month with data). */
  const rawPrevious = (name: string): number | null => {
    const mks = monthsWithData(name);
    return mks.length >= 2 ? monthSum(name, mks[1]) : null;
  };

  /** Resolve a metric value: if computed, evaluate its formula; otherwise use raw sum. */
  const latest = (name: string): number => {
    const tpl = templates.find((t) => t.name === name);
    if (tpl?.computed) return evalFormula(tpl.computed, rawLatest);
    return rawLatest(name);
  };

  const previous = (name: string): number | null => {
    const tpl = templates.find((t) => t.name === name);
    if (tpl?.computed) {
      const val = evalFormula(tpl.computed, (n) => rawPrevious(n) ?? 0);
      const anyPrev = tpl.computed.match(/\b(\w[\w\s]*\w|\w+)\b/g)
        ?.some((n) => rawPrevious(n.trim()) !== null);
      return anyPrev ? val : null;
    }
    return rawPrevious(name);
  };

  const pctChange = (name: string) => {
    const prev = previous(name);
    const curr = latest(name);
    return prev !== null && prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : undefined;
  };

  const filtered = metrics.filter((m) => !search || m.name.toLowerCase().includes(search.toLowerCase()));

  // Compare helpers — sum by month for each list
  const sumFromList = (list: MetricEntry[], name: string) => {
    const mk = [...new Set(list.filter((m) => m.name === name).map((m) => monthKey(m.period)))].sort().reverse()[0];
    if (!mk) return null;
    return list.filter((m) => m.name === name && monthKey(m.period) === mk).reduce((s, m) => s + m.value, 0);
  };

  const latestFromList = (list: MetricEntry[], name: string) => sumFromList(list, name);

  const comparePct = (curr: number, prev: number | null): number | null =>
    prev !== null && prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : null;

  const headerActions = (
    <>
      <ExportButton category={category} label="Exportar" />
      {!disableManualEntry && (
        <>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/metrics/template?category=${category}`} aria-label="Descargar plantilla CSV">
              <Download />
              <span className="hidden sm:inline">Plantilla</span>
            </a>
          </Button>
          <label
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "cursor-pointer focus-within:ring-2 focus-within:ring-ring",
              importing && "pointer-events-none opacity-60",
            )}
            aria-label="Importar CSV"
          >
            <Upload />
            <span className="hidden sm:inline">{importing ? "Importando..." : "CSV"}</span>
            <input type="file" accept=".csv" onChange={handleImport} disabled={importing} className="sr-only" />
          </label>
          <Button size="sm" onClick={() => setShowForm(true)} aria-label="Agregar dato">
            <Plus />
            <span className="hidden sm:inline">Agregar Dato</span>
          </Button>
        </>
      )}
    </>
  );

  const header = hideTitle ? (
    <div className="flex flex-wrap items-center justify-end gap-2">{headerActions}</div>
  ) : (
    <PageHeader icon={defaultIcon} title={title} description={subtitle} actions={headerActions} />
  );

  if (loading) {
    return (
      <div className="space-y-5">
        {header}
        <div className="flex gap-2">
          <Skeleton className="h-9 w-56 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
        <CardsSkeleton count={4} className="grid-cols-2 sm:grid-cols-2" />
        <Card>
          <div className="border-b border-border p-4"><Skeleton className="h-5 w-40" /></div>
          <RowsSkeleton rows={5} />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5">
        {header}
        <Card>
          <ErrorState message={error} onRetry={() => load()} />
        </Card>
      </div>
    );
  }

  const hasData = metrics.length > 0;
  const selectedTemplate = templates.find((t) => t.name === form.name);
  const editIsMoney = editEntry?.unit === "MXN";

  return (
    <div className="space-y-5">
      {header}

      {disableManualEntry && readOnlyNote && (
        <div className="rounded-xl border border-info/30 bg-info/10 px-4 py-3 text-sm text-muted-foreground">
          {readOnlyNote}
        </div>
      )}

      {!hasData ? (
        <Card>
          <EmptyState
            icon={LinkIcon}
            title={emptyTitle}
            description={emptySubtitle}
            action={
              !disableManualEntry && (
                <Button onClick={() => setShowForm(true)}>
                  <Plus /> Entrada Manual
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Rango de meses" className="flex w-fit items-center gap-1 rounded-lg border border-border bg-secondary p-1">
              {[1, 3, 6, 12].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonths(m)}
                  aria-pressed={months === m}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    months === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m === 1 ? "1 mes" : `${m} meses`}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              aria-pressed={autoRefresh}
              className={cn(autoRefresh && "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15")}
            >
              <RefreshCw className={cn(autoRefresh && "animate-spin")} />
              Auto
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCompareMode(!compareMode)}
              aria-pressed={compareMode}
              className={cn(compareMode && "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15")}
            >
              <ArrowLeftRight />
              Comparar período
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Métricas visibles (máximo 4)">
            {templates.map((t) => {
              const on = selectedMetrics.includes(t.name);
              return (
                <button
                  key={t.name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    const next = on
                      ? selectedMetrics.filter((n) => n !== t.name)
                      : [...selectedMetrics, t.name].slice(-4);
                    setSelectedMetrics(next);
                    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* almacenamiento no disponible: solo se pierde la preferencia */ }
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  )}
                >
                  {t.name}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {selectedMetrics.map((name) => {
              const template = templates.find((t) => t.name === name);
              const Icon = iconMap[name] || defaultIcon;
              return (
                <div key={name} className="relative">
                  <MetricCard
                    title={name}
                    value={latest(name)}
                    icon={Icon}
                    format={formatFor(template?.unit)}
                    change={pctChange(name)}
                  />
                  {template?.computed && (
                    <span className="absolute bottom-2 right-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium leading-none text-primary">
                      = calculado
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {extraContent?.(metrics, months)}

          {compareMode && (
            <Card>
              <div className="flex items-center gap-2 border-b border-border p-4">
                <ArrowLeftRight className="h-4 w-4 shrink-0 text-primary" />
                <h2 className="text-sm font-semibold">
                  Comparación con período anterior
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({months === 1 ? "1 mes" : `${months} meses`} actuales vs {months === 1 ? "1 mes" : `${months} meses`} anteriores)
                  </span>
                </h2>
              </div>
              {compareLoading ? (
                <RowsSkeleton rows={Math.min(templates.length, 5)} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                        <th scope="col" className="p-3 font-medium">Métrica</th>
                        <th scope="col" className="p-3 text-right font-medium">Período actual</th>
                        <th scope="col" className="p-3 text-right font-medium">Período anterior</th>
                        <th scope="col" className="p-3 text-right font-medium">Variación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templates.map((t) => {
                        const rawCurr = compareData ? latestFromList(compareData.current, t.name) : null;
                        const rawPrev = compareData ? latestFromList(compareData.previous, t.name) : null;
                        // For computed metrics, evaluate the formula against the compare lists.
                        const currVal = t.computed && compareData
                          ? evalFormula(t.computed, (n) => latestFromList(compareData.current, n) ?? 0)
                          : rawCurr;
                        const prevVal = t.computed && compareData
                          ? evalFormula(t.computed, (n) => latestFromList(compareData.previous, n) ?? 0)
                          : rawPrev;
                        const pct = currVal !== null ? comparePct(currVal, prevVal) : null;
                        const hasAny = currVal !== null || prevVal !== null;
                        return (
                          <tr key={t.name} className="border-b border-border last:border-0 hover:bg-secondary/60">
                            <td className="p-3 font-medium">{t.name}</td>
                            <td className="p-3 text-right font-semibold tabular-nums">
                              {currVal !== null ? fmtValue(currVal, t.unit) : <span className="text-xs text-muted-foreground">Sin datos</span>}
                            </td>
                            <td className="p-3 text-right tabular-nums text-muted-foreground">
                              {prevVal !== null ? fmtValue(prevVal, t.unit) : <span className="text-xs">Sin datos anteriores</span>}
                            </td>
                            <td className="p-3 text-right">
                              {!hasAny ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : pct !== null ? (
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                                    pct >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                                  )}
                                >
                                  {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Sin datos anteriores</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <h2 className="text-sm font-semibold">Registros Recientes</h2>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Buscar registros"
                  placeholder="Buscar..."
                  className="h-9 w-40 pl-9 sm:w-56"
                />
              </div>
            </div>
            {!disableManualEntry && selected.size > 0 && (
              <div className="flex items-center justify-between border-b border-border bg-primary/5 px-4 py-2">
                <span className="text-xs font-medium">{selected.size} seleccionado{selected.size > 1 ? "s" : ""}</span>
                <Button variant="ghost" size="sm" onClick={handleBulkDelete} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 /> Eliminar seleccionados
                </Button>
              </div>
            )}

            {filtered.length === 0 ? (
              <EmptyState icon={SearchX} title="Sin resultados" description="Ningún registro coincide con tu búsqueda." />
            ) : (
              <>
                {/* Mobile card list */}
                <div className="divide-y divide-border sm:hidden">
                  {filtered.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{new Date(m.period).toLocaleDateString("es-MX")}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums">{fmtValue(m.value, m.unit)}</span>
                        {!disableManualEntry && (
                          <div className="flex items-center">
                            <Button variant="ghost" size="icon-sm" aria-label={`Editar ${m.name}`} onClick={() => openEdit(m)}>
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Eliminar ${m.name}`}
                              onClick={() => handleDelete(m.id)}
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                        {!disableManualEntry && (
                          <th scope="col" className="w-8 p-3">
                            <input
                              type="checkbox"
                              aria-label="Seleccionar todos los registros"
                              checked={selected.size === filtered.length && filtered.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) setSelected(new Set(filtered.map((m) => m.id)));
                                else setSelected(new Set());
                              }}
                              className="h-4 w-4 rounded border-border accent-primary"
                            />
                          </th>
                        )}
                        <th scope="col" className="p-3 font-medium">Métrica</th>
                        <th scope="col" className="p-3 text-right font-medium">Valor</th>
                        <th scope="col" className="p-3 font-medium">Fecha</th>
                        {!disableManualEntry && <th scope="col" className="w-24 p-3 font-medium"><span className="sr-only">Acciones</span></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((m) => (
                        <tr key={m.id} className="border-b border-border last:border-0 hover:bg-secondary/60">
                          {!disableManualEntry && (
                            <td className="p-3">
                              <input
                                type="checkbox"
                                aria-label={`Seleccionar ${m.name}`}
                                checked={selected.has(m.id)}
                                onChange={(e) => {
                                  const next = new Set(selected);
                                  if (e.target.checked) next.add(m.id);
                                  else next.delete(m.id);
                                  setSelected(next);
                                }}
                                className="h-4 w-4 rounded border-border accent-primary"
                              />
                            </td>
                          )}
                          <td className="p-3 font-medium">{m.name}</td>
                          <td className="p-3 text-right font-semibold tabular-nums">{fmtValue(m.value, m.unit)}</td>
                          <td className="p-3 text-muted-foreground">{new Date(m.period).toLocaleDateString("es-MX")}</td>
                          {!disableManualEntry && (
                            <td className="p-2">
                              <div className="flex items-center justify-end">
                                <Button variant="ghost" size="icon-sm" aria-label={`Editar ${m.name}`} onClick={() => openEdit(m)}>
                                  <Pencil />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Eliminar ${m.name}`}
                                  onClick={() => handleDelete(m.id)}
                                  className="hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        </>
      )}

      {/* New record */}
      <Dialog open={showForm} onOpenChange={(o) => !o && setShowForm(false)}>
        <DialogContent
          title="Nuevo registro"
          description={`Captura manual de ${activityLabel}.`}
          footer={
            <>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSave} loading={saving} disabled={!form.value}>Guardar</Button>
            </>
          }
        >
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); handleSave(); }}
          >
            <Field label="Tipo">
              <Select value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}>
                {templates.filter((t) => !t.computed).map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
              </Select>
            </Field>
            <Field label="Valor" hint={selectedTemplate?.unit && selectedTemplate.unit !== "MXN" ? `Unidad: ${selectedTemplate.unit}` : undefined}>
              {selectedTemplate?.unit === "MXN" ? (
                <MoneyInput
                  autoFocus
                  type="number"
                  min="0"
                  step="any"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder="0"
                />
              ) : (
                <Input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder="0"
                />
              )}
            </Field>
            <Field label="Período">
              <Input type="date" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} />
            </Field>
            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit record */}
      <Dialog open={editEntry !== null} onOpenChange={(o) => !o && setEditEntry(null)}>
        {editEntry && (
          <DialogContent
            size="sm"
            title={`Editar: ${editEntry.name}`}
            footer={
              <>
                <Button variant="outline" onClick={() => setEditEntry(null)}>Cancelar</Button>
                <Button onClick={handleEdit} loading={editSaving} disabled={!editForm.value}>Guardar</Button>
              </>
            }
          >
            <form
              className="space-y-4"
              onSubmit={(e) => { e.preventDefault(); handleEdit(); }}
            >
              <Field label="Valor">
                {editIsMoney ? (
                  <MoneyInput
                    autoFocus
                    type="number"
                    min="0"
                    step="any"
                    value={editForm.value}
                    onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                  />
                ) : (
                  <Input
                    autoFocus
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={editForm.value}
                    onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Período">
                <Input type="date" value={editForm.period} onChange={(e) => setEditForm({ ...editForm, period: e.target.value })} />
              </Field>
              <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
