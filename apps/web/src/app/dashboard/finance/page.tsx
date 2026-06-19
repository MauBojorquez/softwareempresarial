"use client";

import { useEffect, useState } from "react";
import { DollarSign, TrendingDown, Wallet, PiggyBank, Plus, Loader2, LinkIcon, Trash2, X, Download, Upload, Search, RefreshCw } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { DashboardSkeleton } from "@/components/dashboard/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { addActivityLog } from "@/components/dashboard/activity-log";

type MetricEntry = { id: string; name: string; value: number; unit: string | null; period: string };

const METRIC_TEMPLATES = [
  { name: "Ingresos", unit: "MXN" },
  { name: "Gastos", unit: "MXN" },
  { name: "Cuentas por Cobrar", unit: "MXN" },
  { name: "Cuentas por Pagar", unit: "MXN" },
  { name: "Flujo de Caja", unit: "MXN" },
];

export default function FinancePage() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [months, setMonths] = useState(3);
  const [form, setForm] = useState({ name: "Ingresos", value: "", period: new Date().toISOString().split("T")[0] });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch(`/api/metrics/manual?category=FINANCE&months=${months}`)
      .then((r) => { if (!r.ok) throw new Error("Error al cargar datos"); return r.json(); })
      .then((d) => { setMetrics(d.metrics || []); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  };

  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["Ingresos", "Gastos", "Cuentas por Cobrar", "Flujo de Caja"]);

  useEffect(() => { load(); }, [months]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, months]);

  useEffect(() => {
    const stored = localStorage.getItem("metrixpro-display-FINANCE");
    if (stored) try { setSelectedMetrics(JSON.parse(stored)); } catch {}
  }, []);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", "FINANCE");
    const res = await fetch("/api/metrics/import", { method: "POST", body: fd });
    const data = await res.json();
    if (data.errors?.length > 0) {
      toast(`Importados: ${data.imported}/${data.total}. ${data.errors.length} errores.`, "error");
    } else {
      toast(`${data.imported} registros importados correctamente`, "success");
      addActivityLog("CSV importado", `${data.imported} registros en Finanzas`, "import");
    }
    setImporting(false);
    load();
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!form.value) return;
    setSaving(true);
    const template = METRIC_TEMPLATES.find((t) => t.name === form.name);
    await fetch("/api/metrics/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "FINANCE", name: form.name, value: parseFloat(form.value), unit: template?.unit || "MXN", period: form.period }),
    });
    addActivityLog("Métrica registrada", `${form.name}: ${form.value} en Finanzas`, "add");
    setShowForm(false);
    setForm({ name: "Ingresos", value: "", period: new Date().toISOString().split("T")[0] });
    setSaving(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este registro?")) return;
    await fetch(`/api/metrics/manual?id=${id}`, { method: "DELETE" });
    addActivityLog("Registro eliminado", "Finanzas", "delete");
    toast("Registro eliminado", "success");
    load();
  };

  const fmtMoney = (v: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(v);

  if (loading) return <DashboardSkeleton />;

  if (error) return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-card py-16">
      <div className="rounded-full bg-destructive/10 p-3 mb-4"><X className="h-6 w-6 text-destructive" /></div>
      <h3 className="text-lg font-semibold">Error al cargar datos</h3>
      <p className="mt-1 text-sm text-muted-foreground">{error}</p>
      <button onClick={load} className="mt-4 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90">Reintentar</button>
    </div>
  );

  const byName = (name: string) => metrics.filter((m) => m.name === name).sort((a, b) => b.period.localeCompare(a.period));
  const latest = (name: string) => byName(name)[0]?.value ?? 0;
  const previous = (name: string) => byName(name)[1]?.value ?? null;
  const pctChange = (name: string) => { const prev = previous(name); return prev !== null && prev !== 0 ? ((latest(name) - prev) / Math.abs(prev)) * 100 : undefined; };
  const hasData = metrics.length > 0;

  const ICON_MAP: Record<string, typeof DollarSign> = { "Ingresos": DollarSign, "Gastos": TrendingDown, "Flujo de Caja": Wallet, "Cuentas por Cobrar": PiggyBank, "Cuentas por Pagar": PiggyBank };
  const formatFor = (unit: string | undefined) => unit === "MXN" ? "currency" as const : unit === "%" ? "percentage" as const : "number" as const;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Finanzas</h1>
          <p className="text-sm text-muted-foreground">Métricas financieras</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/metrics/template?category=FINANCE"
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
            <h3 className="font-semibold">Nuevo Registro Financiero</h3>
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
                {METRIC_TEMPLATES.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Monto (MXN)</label>
              <input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="0.00"
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
          <h3 className="text-lg font-semibold">Sin datos financieros</h3>
          <p className="mt-1 text-sm text-muted-foreground text-center max-w-md">
            Conecta el SAT desde integraciones o agrega tus datos financieros manualmente.
          </p>
          <div className="mt-4 flex gap-3">
            <a href="/dashboard/integrations" className="rounded-lg border border-border bg-secondary/50 px-3 py-2 sm:px-4 text-sm font-medium hover:bg-secondary">
              Conectar SAT
            </a>
            <button onClick={() => setShowForm(true)} className="rounded-lg gradient-bg px-3 py-2 sm:px-4 text-sm font-medium text-white hover:opacity-90">
              Entrada Manual
            </button>
          </div>
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
            {METRIC_TEMPLATES.map((t) => (
              <button
                key={t.name}
                onClick={() => {
                  const next = selectedMetrics.includes(t.name)
                    ? selectedMetrics.filter((n) => n !== t.name)
                    : [...selectedMetrics, t.name].slice(-4);
                  setSelectedMetrics(next);
                  localStorage.setItem("metrixpro-display-FINANCE", JSON.stringify(next));
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
              const template = METRIC_TEMPLATES.find((t) => t.name === name);
              return <MetricCard key={name} title={name} value={latest(name)} icon={ICON_MAP[name] || DollarSign} format={formatFor(template?.unit)} change={pctChange(name)} />;
            })}
          </div>

          {/* ── Monthly Trend Chart ── */}
          {(() => {
            const now = new Date();
            const monthSlots = Array.from({ length: months }, (_, i) => {
              const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
              return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("es-MX", { month: "short", year: months > 6 ? "2-digit" : undefined }) };
            });
            const sum = (name: string, key: string) =>
              metrics.filter((m) => m.name === name && m.period.startsWith(key)).reduce((s, m) => s + m.value, 0);
            const ingData = monthSlots.map((s) => sum("Ingresos", s.key));
            const gasData = monthSlots.map((s) => sum("Gastos", s.key));
            const maxVal = Math.max(...ingData, ...gasData, 1);
            const BAR_H = 80;
            const barW = Math.max(8, Math.floor(260 / monthSlots.length) - 4);
            const gap = Math.max(2, Math.floor(260 / monthSlots.length) * 0.2);
            const totalW = monthSlots.length * (barW * 2 + gap + 4);
            const hasChart = ingData.some((v) => v > 0) || gasData.some((v) => v > 0);
            if (!hasChart) return null;
            return (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm">Tendencia Mensual</h3>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" />Ingresos</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-red-400" />Gastos</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <svg viewBox={`0 0 ${Math.max(totalW, 300)} ${BAR_H + 24}`} className="w-full" style={{ minWidth: `${Math.max(totalW, 300)}px`, maxWidth: "100%", height: `${BAR_H + 30}px` }}>
                    {monthSlots.map((slot, i) => {
                      const x = i * (barW * 2 + gap + 4);
                      const ingH = (ingData[i] / maxVal) * BAR_H;
                      const gasH = (gasData[i] / maxVal) * BAR_H;
                      return (
                        <g key={slot.key}>
                          {ingData[i] > 0 && <rect x={x} y={BAR_H - ingH} width={barW} height={ingH} rx="3" fill="rgb(16 185 129 / 0.7)" />}
                          {gasData[i] > 0 && <rect x={x + barW + gap} y={BAR_H - gasH} width={barW} height={gasH} rx="3" fill="rgb(248 113 113 / 0.7)" />}
                          <text x={x + barW} y={BAR_H + 14} textAnchor="middle" fontSize="9" fill="currentColor" className="text-muted-foreground" style={{ opacity: 0.6 }}>{slot.label}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            );
          })()}

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
                  onClick={async () => {
                    if (!confirm(`¿Eliminar ${selected.size} registro${selected.size > 1 ? "s" : ""}?`)) return;
                    await Promise.all(Array.from(selected).map((id) => fetch(`/api/metrics/manual?id=${id}`, { method: "DELETE" })));
                    setSelected(new Set());
                    load();
                  }}
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
                        checked={selected.size === metrics.filter((m) => !search || m.name.toLowerCase().includes(search.toLowerCase())).length && metrics.filter((m) => !search || m.name.toLowerCase().includes(search.toLowerCase())).length > 0}
                        onChange={(e) => {
                          if (e.target.checked) setSelected(new Set(metrics.filter((m) => !search || m.name.toLowerCase().includes(search.toLowerCase())).map((m) => m.id)));
                          else setSelected(new Set());
                        }}
                        className="rounded border-border"
                      />
                    </th>
                    <th scope="col" className="p-3 font-medium">Concepto</th>
                    <th scope="col" className="p-3 font-medium text-right">Monto</th>
                    <th scope="col" className="p-3 font-medium">Fecha</th>
                    <th scope="col" className="p-3 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.filter((m) => !search || m.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">Sin resultados</td></tr>
                  )}
                  {metrics.filter((m) => !search || m.name.toLowerCase().includes(search.toLowerCase())).map((m) => (
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
                      <td className="p-3 text-right font-semibold">{fmtMoney(m.value)}</td>
                      <td className="p-3 text-muted-foreground">{new Date(m.period).toLocaleDateString("es-MX")}</td>
                      <td className="p-3">
                        <button aria-label={`Eliminar ${m.name}`} onClick={() => handleDelete(m.id)} className="text-muted-foreground hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
