"use client";

import { useEffect, useState, useCallback } from "react";
import { TrendingUp, Target, Users, UserPlus, RefreshCw, Loader2, Link as LinkIcon, Plus, X, Trash2, Search, Pencil, FileSpreadsheet } from "lucide-react";
import { useSession } from "next-auth/react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { DashboardSkeleton } from "@/components/dashboard/skeleton";
import { ExcelImportModal } from "@/components/dashboard/excel-import-modal";
import { cn, formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { addActivityLog } from "@/components/dashboard/activity-log";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Stage = { stage: string; label: string; count: number };
type PipelineStage = { stageId: string; label: string; count: number; amount: number };
type HubSpotData = {
  connected: boolean;
  error?: string;
  contacts?: { total: number; newThisMonth: number; byStage: Stage[] };
  pipeline?: {
    stages: PipelineStage[];
    total: number;
    closedWon: { count: number; amount: number };
    closedLost: { count: number };
  };
  lastSyncAt?: string;
};

type MetricEntry = { id: string; name: string; value: number; unit: string | null; period: string };

const METRIC_TEMPLATES = [
  { name: "Ventas del Mes", unit: "MXN" },
  { name: "Deals Cerrados", unit: "unidades" },
  { name: "Nuevos Leads", unit: "unidades" },
  { name: "Pipeline Total", unit: "MXN" },
  { name: "Ticket Promedio", unit: "MXN" },
];

const fmtMoney = formatCurrency;

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "Justo ahora";
  if (diff < 60) return `Hace ${diff} min`;
  return `Hace ${Math.floor(diff / 60)}h`;
}

export default function SalesPage() {
  const { toast } = useToast();
  const { data: session } = useSession();
  const canImport = session?.user?.role !== "VIEWER";
  const [showExcel, setShowExcel] = useState(false);
  const [hs, setHs] = useState<HubSpotData | null>(null);
  const [hsLoading, setHsLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState<string>("all");

  // Manual metrics state
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "Ventas del Mes", value: "", period: new Date().toISOString().split("T")[0] });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteCount, setBulkDeleteCount] = useState(0);
  const [editEntry, setEditEntry] = useState<MetricEntry | null>(null);
  const [editForm, setEditForm] = useState({ value: "", period: "" });
  const [editSaving, setEditSaving] = useState(false);

  const loadHubSpot = useCallback(() => {
    setHsLoading(true);
    fetch("/api/metrics/sales/hubspot")
      .then((r) => r.json())
      .then((d) => { setHs(d); setHsLoading(false); })
      .catch(() => { setHs({ connected: false }); setHsLoading(false); });
  }, []);

  const loadManual = useCallback(() => {
    setManualLoading(true);
    setManualError(null);
    fetch("/api/metrics/manual?category=SALES&months=3")
      .then((r) => { if (!r.ok) throw new Error("Error al cargar las métricas"); return r.json(); })
      .then((d) => { setMetrics(d.metrics || []); setManualLoading(false); })
      .catch((e) => { setManualError(e.message || "Error al cargar las métricas"); setManualLoading(false); });
  }, []);

  useEffect(() => { loadHubSpot(); loadManual(); }, [loadHubSpot, loadManual]);

  const handleSave = async () => {
    if (!form.value) return;
    setSaving(true);
    const template = METRIC_TEMPLATES.find((t) => t.name === form.name);
    try {
      const res = await fetch("/api/metrics/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "SALES", name: form.name, value: parseFloat(form.value), unit: template?.unit || "MXN", period: form.period }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(data.error || "Error al guardar el registro", "error");
        setSaving(false);
        return;
      }
      addActivityLog("Métrica registrada", `${form.name}: ${form.value} en Ventas`, "add");
      toast("Registro guardado correctamente", "success");
      setShowForm(false);
      setForm({ name: "Ventas del Mes", value: "", period: new Date().toISOString().split("T")[0] });
      loadManual();
    } catch {
      toast("Error de conexión", "error");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/metrics/manual?id=${id}`, { method: "DELETE" });
    addActivityLog("Registro eliminado", "Ventas", "delete");
    toast("Registro eliminado", "success");
    setDeleteId(null);
    loadManual();
  };

  const handleBulkDelete = async () => {
    await Promise.all(Array.from(selected).map((id) => fetch(`/api/metrics/manual?id=${id}`, { method: "DELETE" })));
    setSelected(new Set());
    setBulkDeleteCount(0);
    loadManual();
  };

  const openEdit = (entry: MetricEntry) => {
    setEditEntry(entry);
    setEditForm({ value: String(entry.value), period: entry.period.slice(0, 10) });
  };

  const handleEdit = async () => {
    if (!editEntry) return;
    setEditSaving(true);
    try {
      const res = await fetch("/api/metrics/manual", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editEntry.id, value: editForm.value, period: editForm.period }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(data.error || "Error al actualizar el registro", "error");
        setEditSaving(false);
        return;
      }
      setEditEntry(null);
      loadManual();
      toast("Registro actualizado", "success");
    } catch {
      toast("Error de conexión", "error");
    }
    setEditSaving(false);
  };

  if (hsLoading) return <DashboardSkeleton />;

  const hubspotConnected = hs?.connected && !hs?.error && hs?.contacts;

  const stageCount = selectedStage === "all"
    ? (hs?.contacts?.total ?? 0)
    : (hs?.contacts?.byStage?.find((s) => s.stage === selectedStage)?.count ?? 0);

  const stageLabel = selectedStage === "all"
    ? "Total contactos"
    : (hs?.contacts?.byStage?.find((s) => s.stage === selectedStage)?.label ?? selectedStage);

  const maxDeals = Math.max(1, ...(hs?.pipeline?.stages?.map((s) => s.count) ?? [1]));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Ventas</h1>
          {hs?.lastSyncAt && (
            <p className="text-xs text-muted-foreground">
              Última sincronización: {timeAgo(hs.lastSyncAt)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canImport && (
            <button
              onClick={() => setShowExcel(true)}
              title="Importar desde Excel"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          )}
          {hubspotConnected && (
            <button
              onClick={loadHubSpot}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sincronizar</span>
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg gradient-bg px-3 py-2 sm:px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Agregar</span>
          </button>
        </div>
      </div>

      {/* Manual form */}
      {showForm && (
        <div className="rounded-xl border border-primary/20 bg-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Nuevo Registro</h3>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <select value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                {METRIC_TEMPLATES.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Valor</label>
              <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="0" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Período</label>
              <input type="date" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving || !form.value} className="mt-4 rounded-lg gradient-bg px-6 py-2 text-sm font-medium text-white disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      )}

      {/* HubSpot not connected banner */}
      {!hubspotConnected && (
        <div className="rounded-xl border border-border bg-card p-6 flex items-start gap-4">
          <div className="rounded-lg bg-orange-500/10 p-3">
            <LinkIcon className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h3 className="font-semibold">Conecta tu CRM</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Conecta HubSpot para ver tu pipeline de ventas, contactos por etapa y negocios cerrados en tiempo real.
            </p>
            <a href="/dashboard/integrations" className="mt-3 inline-block rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              Conectar HubSpot
            </a>
          </div>
        </div>
      )}

      {/* HubSpot live data */}
      {hubspotConnected && (
        <>
          {/* Summary cards */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Total Contactos" value={hs.contacts!.total} icon={Users} format="number" />
            <MetricCard title="Nuevos este Mes" value={hs.contacts!.newThisMonth} icon={UserPlus} format="number" />
            <MetricCard title="Pipeline Total" value={hs.pipeline?.total ?? 0} icon={TrendingUp} format="currency" />
            <MetricCard title="Negocios Ganados" value={hs.pipeline?.closedWon.count ?? 0} icon={Target} format="number" />
          </div>

          {/* Contacts by stage */}
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
            <h3 className="font-semibold mb-4">Base de Datos — Contactos por Etapa</h3>

            {/* Filter chips */}
            <div className="flex flex-wrap gap-1.5 mb-5">
              <button
                onClick={() => setSelectedStage("all")}
                className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", selectedStage === "all" ? "gradient-bg text-white" : "bg-secondary/50 text-muted-foreground hover:bg-secondary")}
              >
                Todos ({hs.contacts!.total})
              </button>
              {hs.contacts!.byStage.map((s) => (
                <button
                  key={s.stage}
                  onClick={() => setSelectedStage(s.stage)}
                  className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", selectedStage === s.stage ? "gradient-bg text-white" : "bg-secondary/50 text-muted-foreground hover:bg-secondary")}
                >
                  {s.label} ({s.count})
                </button>
              ))}
            </div>

            {/* Selected count highlight */}
            <div className="mb-5 flex items-end gap-2">
              <span className="text-4xl font-bold">{stageCount.toLocaleString("es-MX")}</span>
              <span className="mb-1 text-sm text-muted-foreground">{stageLabel}</span>
            </div>

            {/* Horizontal bars */}
            <div className="space-y-2.5">
              {hs.contacts!.byStage.map((s) => {
                const pct = hs.contacts!.total > 0 ? (s.count / hs.contacts!.total) * 100 : 0;
                return (
                  <div key={s.stage} className="grid grid-cols-[120px_1fr_40px] items-center gap-3">
                    <span className="text-xs text-muted-foreground truncate">{s.label}</span>
                    <div className="h-2 rounded-full bg-secondary/50 overflow-hidden">
                      <div className="h-full rounded-full gradient-bg" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-medium text-right">{s.count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pipeline stages */}
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
            <h3 className="font-semibold mb-4">Pipeline de Negocios</h3>

            {hs.pipeline!.stages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin negocios activos en el pipeline.</p>
            ) : (
              <div className="space-y-3">
                {hs.pipeline!.stages.map((s) => {
                  const pct = Math.round((s.count / maxDeals) * 100);
                  return (
                    <div key={s.stageId} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{s.label}</span>
                        <div className="flex items-center gap-4 text-muted-foreground text-xs">
                          <span>{s.count} negocio{s.count !== 1 ? "s" : ""}</span>
                          <span className="font-semibold text-foreground">{fmtMoney(s.amount)}</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-secondary/50 overflow-hidden">
                        <div className="h-full rounded-full gradient-bg" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Closed won / lost */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
                <p className="text-xs text-emerald-600 font-medium">Negocios Ganados</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600">{hs.pipeline!.closedWon.count}</p>
                <p className="text-xs text-emerald-600/70">{fmtMoney(hs.pipeline!.closedWon.amount)}</p>
              </div>
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
                <p className="text-xs text-red-500 font-medium">Negocios Perdidos</p>
                <p className="mt-1 text-2xl font-bold text-red-500">{hs.pipeline!.closedLost.count}</p>
                <p className="text-xs text-red-500/70">Este período</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Manual metrics error */}
      {manualError && !manualLoading && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-red-600">{manualError}</p>
          <button onClick={loadManual} className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary">
            <RefreshCw className="h-3.5 w-3.5" /> Reintentar
          </button>
        </div>
      )}

      {/* Manual metrics table */}
      {metrics.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h3 className="font-semibold">Registros Manuales</h3>
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
            {manualLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th scope="col" className="p-3 w-8">
                      <input type="checkbox" aria-label="Seleccionar todos" checked={selected.size === metrics.length && metrics.length > 0} onChange={(e) => { if (e.target.checked) setSelected(new Set(metrics.map((m) => m.id))); else setSelected(new Set()); }} className="rounded border-border" />
                    </th>
                    <th scope="col" className="p-3 font-medium">Concepto</th>
                    <th scope="col" className="p-3 font-medium text-right">Valor</th>
                    <th scope="col" className="p-3 font-medium">Fecha</th>
                    <th scope="col" className="p-3 font-medium w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.filter((m) => !search || m.name.toLowerCase().includes(search.toLowerCase())).map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                      <td className="p-3">
                        <input type="checkbox" aria-label={`Seleccionar ${m.name}`} checked={selected.has(m.id)} onChange={(e) => { const n = new Set(selected); if (e.target.checked) n.add(m.id); else n.delete(m.id); setSelected(n); }} className="rounded border-border" />
                      </td>
                      <td className="p-3 font-medium">{m.name}</td>
                      <td className="p-3 text-right font-semibold">
                        {m.unit === "MXN" ? fmtMoney(m.value) : m.value.toLocaleString("es-MX")}
                      </td>
                      <td className="p-3 text-muted-foreground">{new Date(m.period).toLocaleDateString("es-MX")}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <button aria-label={`Editar ${m.name}`} onClick={() => openEdit(m)} className="text-muted-foreground hover:text-primary">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button aria-label={`Eliminar ${m.name}`} onClick={() => setDeleteId(m.id)} className="text-muted-foreground hover:text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Empty state when no HubSpot and no manual data */}
      {!hubspotConnected && metrics.length === 0 && !manualLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-14">
          <LinkIcon className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Sin datos de ventas</h3>
          <p className="mt-1 text-sm text-muted-foreground text-center max-w-md">
            Conecta HubSpot desde integraciones, importa un CSV o registra tus ventas manualmente.
          </p>
          <div className="mt-4 flex gap-3 flex-wrap justify-center">
            <a href="/dashboard/integrations" className="rounded-lg border border-border bg-secondary/50 px-4 py-2 text-sm font-medium hover:bg-secondary">
              Conectar HubSpot
            </a>
            <button onClick={() => setShowForm(true)} className="rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              Entrada Manual
            </button>
          </div>
        </div>
      )}

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

      <ExcelImportModal
        open={showExcel}
        onClose={() => setShowExcel(false)}
        onImported={() => loadManual()}
        defaultCategory="SALES"
      />
    </div>
  );
}
