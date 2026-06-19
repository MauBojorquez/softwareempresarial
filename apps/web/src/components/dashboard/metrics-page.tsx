"use client";

import { useEffect, useState } from "react";
import { type LucideIcon } from "lucide-react";
import { Plus, Trash2, X, Download, Upload, Search, RefreshCw, LinkIcon, Pencil } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { DashboardSkeleton } from "@/components/dashboard/skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn, formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { addActivityLog } from "@/components/dashboard/activity-log";

export type MetricTemplate = { name: string; unit: string };
type MetricEntry = { id: string; name: string; value: number; unit: string | null; period: string };

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
}: MetricsDashboardProps) {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [months, setMonths] = useState(3);
  const [form, setForm] = useState({ name: templates[0].name, value: "", period: new Date().toISOString().split("T")[0] });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(defaultSelected);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteCount, setBulkDeleteCount] = useState(0);
  const [editEntry, setEditEntry] = useState<MetricEntry | null>(null);
  const [editForm, setEditForm] = useState({ value: "", period: "" });
  const [editSaving, setEditSaving] = useState(false);

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
    const stored = localStorage.getItem(storageKey);
    if (stored) try { setSelectedMetrics(JSON.parse(stored)); } catch {}
  }, []);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", category);
    const res = await fetch("/api/metrics/import", { method: "POST", body: fd });
    const data = await res.json();
    if (data.errors?.length > 0) {
      toast(`Importados: ${data.imported}/${data.total}. ${data.errors.length} errores.`, "error");
    } else {
      toast(`${data.imported} registros importados correctamente`, "success");
      addActivityLog("CSV importado", `${data.imported} registros en ${activityLabel}`, "import");
    }
    setImporting(false);
    load();
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!form.value) return;
    setSaving(true);
    const template = templates.find((t) => t.name === form.name);
    await fetch("/api/metrics/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, name: form.name, value: parseFloat(form.value), unit: template?.unit || "", period: form.period }),
    });
    addActivityLog("Métrica registrada", `${form.name}: ${form.value} en ${activityLabel}`, "add");
    setShowForm(false);
    setForm({ name: templates[0].name, value: "", period: new Date().toISOString().split("T")[0] });
    setSaving(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/metrics/manual?id=${id}`, { method: "DELETE" });
    addActivityLog("Registro eliminado", activityLabel, "delete");
    toast("Registro eliminado", "success");
    setDeleteId(null);
    load();
  };

  const openEdit = (entry: MetricEntry) => {
    setEditEntry(entry);
    setEditForm({ value: String(entry.value), period: entry.period.slice(0, 10) });
  };

  const handleEdit = async () => {
    if (!editEntry) return;
    setEditSaving(true);
    await fetch("/api/metrics/manual", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editEntry.id, value: editForm.value, period: editForm.period }),
    });
    setEditEntry(null);
    setEditSaving(false);
    load();
    toast("Registro actualizado", "success");
  };

  const handleBulkDelete = async () => {
    await Promise.all(Array.from(selected).map((id) => fetch(`/api/metrics/manual?id=${id}`, { method: "DELETE" })));
    setSelected(new Set());
    setBulkDeleteCount(0);
    load();
  };

  const formatFor = (unit: string | undefined) =>
    unit === "MXN" ? "currency" as const : unit === "%" ? "percentage" as const : "number" as const;

  const byName = (name: string) => metrics.filter((m) => m.name === name).sort((a, b) => b.period.localeCompare(a.period));
  const latest = (name: string) => byName(name)[0]?.value ?? 0;
  const previous = (name: string) => byName(name)[1]?.value ?? null;
  const pctChange = (name: string) => {
    const prev = previous(name);
    return prev !== null && prev !== 0 ? ((latest(name) - prev) / Math.abs(prev)) * 100 : undefined;
  };

  const filtered = metrics.filter((m) => !search || m.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <DashboardSkeleton />;

  if (error) return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-card py-16">
      <div className="rounded-full bg-destructive/10 p-3 mb-4"><X className="h-6 w-6 text-destructive" /></div>
      <h3 className="text-lg font-semibold">Error al cargar datos</h3>
      <p className="mt-1 text-sm text-muted-foreground">{error}</p>
      <button onClick={() => load()} className="mt-4 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90">Reintentar</button>
    </div>
  );

  const hasData = metrics.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/metrics/template?category=${category}`}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Plantilla</span>
          </a>
          <label className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{importing ? "Importando..." : "Importar"}</span>
            <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
          </label>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg gradient-bg px-3 py-2 sm:px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Agregar Dato</span>
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-primary/20 bg-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Nuevo Registro</h3>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <select
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {templates.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Valor</label>
              <input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="0"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Período</label>
              <input
                type="date"
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !form.value}
            className="mt-4 rounded-lg gradient-bg px-6 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      )}

      {!hasData ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-14 sm:py-20">
          <LinkIcon className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">{emptyTitle}</h3>
          <p className="mt-1 text-sm text-muted-foreground text-center max-w-md">{emptySubtitle}</p>
          <button onClick={() => setShowForm(true)} className="mt-4 rounded-lg gradient-bg px-3 py-2 sm:px-4 text-sm font-medium text-white hover:opacity-90">
            Entrada Manual
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/50 p-1 w-fit">
              {[1, 3, 6, 12].map((m) => (
                <button
                  key={m}
                  onClick={() => setMonths(m)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    months === m ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m === 1 ? "1 mes" : `${m} meses`}
                </button>
              ))}
            </div>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                "rounded-lg border border-border px-3 py-1 text-xs font-medium transition-colors",
                autoRefresh ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <RefreshCw className={cn("h-3 w-3 inline mr-1", autoRefresh && "animate-spin")} />
              Auto
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {templates.map((t) => (
              <button
                key={t.name}
                onClick={() => {
                  const next = selectedMetrics.includes(t.name)
                    ? selectedMetrics.filter((n) => n !== t.name)
                    : [...selectedMetrics, t.name].slice(-4);
                  setSelectedMetrics(next);
                  localStorage.setItem(storageKey, JSON.stringify(next));
                }}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  selectedMetrics.includes(t.name)
                    ? "gradient-bg text-white"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                )}
              >
                {t.name}
              </button>
            ))}
          </div>

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {selectedMetrics.map((name) => {
              const template = templates.find((t) => t.name === name);
              const Icon = iconMap[name] || defaultIcon;
              return (
                <MetricCard
                  key={name}
                  title={name}
                  value={latest(name)}
                  icon={Icon}
                  format={formatFor(template?.unit)}
                  change={pctChange(name)}
                />
              );
            })}
          </div>

          {extraContent?.(metrics, months)}

          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="font-semibold">Registros Recientes</h3>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="w-32 sm:w-48 rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-xs"
                />
              </div>
            </div>
            {selected.size > 0 && (
              <div className="flex items-center justify-between border-b border-border bg-primary/5 px-4 py-2">
                <span className="text-xs font-medium">{selected.size} seleccionado{selected.size > 1 ? "s" : ""}</span>
                <button
                  onClick={() => setBulkDeleteCount(selected.size)}
                  className="text-xs font-medium text-red-500 hover:text-red-600"
                >
                  Eliminar seleccionados
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th scope="col" className="p-3 w-8">
                      <input
                        type="checkbox"
                        checked={selected.size === filtered.length && filtered.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) setSelected(new Set(filtered.map((m) => m.id)));
                          else setSelected(new Set());
                        }}
                        className="rounded border-border"
                      />
                    </th>
                    <th scope="col" className="p-3 font-medium">Métrica</th>
                    <th scope="col" className="p-3 font-medium text-right">Valor</th>
                    <th scope="col" className="p-3 font-medium">Fecha</th>
                    <th scope="col" className="p-3 font-medium w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">Sin resultados</td></tr>
                  )}
                  {filtered.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selected.has(m.id)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(m.id);
                            else next.delete(m.id);
                            setSelected(next);
                          }}
                          className="rounded border-border"
                        />
                      </td>
                      <td className="p-3 font-medium">{m.name}</td>
                      <td className="p-3 text-right font-semibold">{fmtValue(m.value, m.unit)}</td>
                      <td className="p-3 text-muted-foreground">{new Date(m.period).toLocaleDateString("es-MX")}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <button
                            aria-label={`Editar ${m.name}`}
                            onClick={() => openEdit(m)}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            aria-label={`Eliminar ${m.name}`}
                            onClick={() => setDeleteId(m.id)}
                            className="text-muted-foreground hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Edit Modal */}
      {editEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setEditEntry(null)} />
          <div className="relative w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Editar: {editEntry.name}</h3>
              <button onClick={() => setEditEntry(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Valor</label>
                <input
                  type="number"
                  value={editForm.value}
                  onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Período</label>
                <input
                  type="date"
                  value={editForm.period}
                  onChange={(e) => setEditForm({ ...editForm, period: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditEntry(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary">
                Cancelar
              </button>
              <button
                onClick={handleEdit}
                disabled={editSaving || !editForm.value}
                className="rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {editSaving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Eliminar registro"
        description="¿Eliminar este registro? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmDialog
        open={bulkDeleteCount > 0}
        title="Eliminar registros"
        description={`¿Eliminar ${bulkDeleteCount} registro${bulkDeleteCount > 1 ? "s" : ""}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkDeleteCount(0)}
      />
    </div>
  );
}
