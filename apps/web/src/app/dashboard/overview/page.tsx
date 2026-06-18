"use client";

import { useEffect, useState } from "react";
import {
  DollarSign, TrendingUp, Users, ShoppingCart, RefreshCw, LinkIcon, Plus, ArrowRight,
  Target, Calculator, Download, ChevronDown, Megaphone, BarChart3, Wallet, FileText, PlusCircle
} from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { cn } from "@/lib/utils";
import { Onboarding } from "@/components/dashboard/onboarding";
import { ActivityLog } from "@/components/dashboard/activity-log";

type DashboardData = {
  revenue: number; revenueChange: number;
  gastos: number; gastosChange: number;
  pipeline: number; pipelineChange: number;
  employees: number; employeesChange: number;
  conversion: number; conversionChange: number;
  nomina: number;
  hasData: boolean;
  calculated: {
    ytdRevenue: number; ytdGastos: number;
    annualProjection: number; revenuePerEmployee: number;
    utilidad: number; margen: number;
  };
  goals: Array<{ name: string; current: number; target: number; unit: string }>;
  monthlyHistory: { month: string; ingresos: number; gastos: number }[];
  metaSummary: { spend: number; clicks: number; impressions: number; reach: number } | null;
  metaConnected: boolean;
};

const fmtMoney = (v: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(v);
const fmt = (v: number) => new Intl.NumberFormat("es-MX").format(Math.round(v));

export default function OverviewPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGoals, setShowGoals] = useState(false);
  const [goalForm, setGoalForm] = useState({ metric: "Ingresos", target: "", unit: "MXN" });
  const [savingGoal, setSavingGoal] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/metrics/dashboard");
      if (res.ok) setData(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveGoal = async () => {
    if (!goalForm.target) return;
    setSavingGoal(true);
    await fetch("/api/metrics/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metric: goalForm.metric, target: parseFloat(goalForm.target), unit: goalForm.unit }),
    });
    setSavingGoal(false);
    setShowGoals(false);
    setGoalForm({ metric: "Ingresos", target: "", unit: "MXN" });
    load();
  };

  const downloadMetrics = async () => {
    setDownloading(true);
    const res = await fetch("/api/reports/pdf?type=metrics");
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Metricas-${new Date().toISOString().split("T")[0]}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setDownloading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.hasData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Resumen ejecutivo de tu negocio</p>
        </div>
        <Onboarding />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Ingresos" value={0} icon={DollarSign} format="currency" />
          <MetricCard title="Pipeline" value={0} icon={TrendingUp} format="currency" />
          <MetricCard title="Equipo" value={0} icon={Users} format="number" />
          <MetricCard title="Conversión" value={0} icon={ShoppingCart} format="percentage" />
        </div>
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8 overflow-hidden">
          <div className="w-full h-1 gradient-bg rounded-t-xl -mt-[25px] sm:-mt-[33px] mb-6" />
          <div className="flex flex-col items-center justify-center text-center">
            <LinkIcon className="h-8 w-8 text-muted-foreground mb-3 sm:h-10 sm:w-10 sm:mb-4" />
            <h3 className="text-base font-semibold sm:text-lg">Comienza a agregar tus datos</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-lg">
              Tu dashboard se llenará automáticamente cuando conectes integraciones o registres datos manualmente.
            </p>
            <div className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-3 w-full max-w-xl">
              {[
                { href: "/dashboard/finance", icon: DollarSign, label: "Finanzas", color: "text-blue-600" },
                { href: "/dashboard/sales", icon: TrendingUp, label: "Ventas", color: "text-emerald-600" },
                { href: "/dashboard/integrations", icon: Plus, label: "Integraciones", color: "text-purple-600" },
              ].map((item) => (
                <a key={item.href} href={item.href} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <item.icon className={cn("h-4 w-4", item.color)} />
                    <span>{item.label}</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { calculated, goals, monthlyHistory, metaSummary, metaConnected } = data;
  const maxHistory = Math.max(...monthlyHistory.map((m) => Math.max(m.ingresos, m.gastos)), 1);

  const goalProgress = (current: number, target: number) => {
    if (target <= 0) return null;
    return Math.min((current / target) * 100, 100);
  };

  return (
    <div className="space-y-5">
      <div className="hidden lg:flex items-center gap-2">
        <a href="/dashboard/finance" className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary">
          <PlusCircle className="h-3.5 w-3.5" />Agregar dato
        </a>
        <a href="/dashboard/reports" className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary">
          <FileText className="h-3.5 w-3.5" />Generar reporte
        </a>
        <button onClick={downloadMetrics} disabled={downloading} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50">
          <Download className="h-3.5 w-3.5" />{downloading ? "Exportando..." : "Exportar"}
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Resumen ejecutivo de tu negocio</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadMetrics}
            disabled={downloading}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{downloading ? "Descargando..." : "Exportar"}</span>
          </button>
          <button
            onClick={() => setShowGoals(!showGoals)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary"
          >
            <Target className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Metas</span>
          </button>
          <button
            onClick={() => { setLoading(true); load(); }}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <Onboarding />

      {showGoals && (
        <div className="rounded-xl border border-primary/20 bg-card p-4 sm:p-5">
          <h3 className="text-sm font-semibold mb-3">Establecer Meta Mensual</h3>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <select
              value={goalForm.metric}
              onChange={(e) => {
                const unitMap: Record<string, string> = {
                  "Ingresos": "MXN", "Gastos": "MXN", "Pipeline Total": "MXN", "Ventas del Mes": "MXN",
                  "Deals Cerrados": "unidades", "Nuevos Leads": "unidades", "Headcount": "personas",
                  "Nuevas Contrataciones": "personas", "Tareas Completadas": "unidades", "Eficiencia": "%",
                  "SLA Cumplimiento": "%", "Rotación": "%", "Satisfacción": "pts", "Costo Nómina": "MXN",
                };
                setGoalForm({ ...goalForm, metric: e.target.value, unit: unitMap[e.target.value] || "" });
              }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="Ingresos">Ingresos (MXN)</option>
              <option value="Gastos">Gastos (MXN)</option>
              <option value="Pipeline Total">Pipeline Total (MXN)</option>
              <option value="Ventas del Mes">Ventas del Mes (MXN)</option>
              <option value="Deals Cerrados">Deals Cerrados (unidades)</option>
              <option value="Nuevos Leads">Nuevos Leads (unidades)</option>
              <option value="Headcount">Headcount (personas)</option>
              <option value="Nuevas Contrataciones">Nuevas Contrataciones (personas)</option>
              <option value="Tareas Completadas">Tareas Completadas (unidades)</option>
              <option value="Eficiencia">Eficiencia (%)</option>
              <option value="SLA Cumplimiento">SLA Cumplimiento (%)</option>
              <option value="Rotación">Rotación (%)</option>
              <option value="Satisfacción">Satisfacción (pts)</option>
              <option value="Costo Nómina">Costo Nómina (MXN)</option>
            </select>
            <input
              type="number"
              value={goalForm.target}
              onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })}
              placeholder="Valor objetivo"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={saveGoal}
              disabled={savingGoal || !goalForm.target}
              className="rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {savingGoal ? "Guardando..." : "Guardar Meta"}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Ingresos" value={data.revenue} change={data.revenueChange || undefined} icon={DollarSign} format="currency" />
        <MetricCard title="Gastos" value={data.gastos} change={data.gastosChange || undefined} icon={Wallet} format="currency" />
        <MetricCard title="Equipo" value={data.employees} change={data.employeesChange || undefined} icon={Users} format="number" />
        <MetricCard title="Conversión" value={data.conversion} change={data.conversionChange || undefined} icon={ShoppingCart} format="percentage" />
      </div>

      {goals.length > 0 && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {goals.filter((g) => g.target > 0).map((g) => {
            const pct = goalProgress(g.current, g.target);
            const fmtGoalVal = (v: number) => {
              if (g.unit === "MXN") return fmtMoney(v);
              if (g.unit === "%") return `${v}%`;
              if (g.unit === "pts") return `${fmt(v)} pts`;
              return fmt(v);
            };
            return (
              <div key={g.name} className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs font-medium text-muted-foreground">{g.name}</div>
                <div className="mt-2 h-5 rounded-full bg-secondary/50 relative">
                  <div
                    className={cn("h-5 rounded-full transition-all", pct && pct >= 100 ? "bg-emerald-500" : "gradient-bg")}
                    style={{ width: `${pct || 0}%` }}
                  />
                  <span className={cn("absolute top-0.5 text-[10px] font-semibold leading-4", (pct || 0) > 30 ? "text-white" : "text-foreground")} style={{ left: (pct || 0) > 30 ? undefined : `${(pct || 0) + 2}%`, right: (pct || 0) > 30 ? 6 : undefined }}>
                    {pct?.toFixed(0)}%
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {fmtGoalVal(g.current)} / {fmtGoalVal(g.target)}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-semibold">KPIs Calculados</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: "Facturación Anual (YTD)", value: fmtMoney(calculated.ytdRevenue), color: "" },
              { label: "Proyección Anual", value: fmtMoney(calculated.annualProjection), color: "" },
              { label: "Ingreso por Colaborador", value: data.employees > 0 ? fmtMoney(calculated.revenuePerEmployee) : "—", color: "" },
              { label: "Utilidad Neta", value: fmtMoney(calculated.utilidad), color: calculated.utilidad >= 0 ? "text-emerald-600" : "text-red-600" },
              { label: "Margen Neto", value: `${calculated.margen}%`, color: calculated.margen > 10 ? "text-emerald-600" : calculated.margen >= 5 ? "text-yellow-600" : "text-red-600" },
            ].map((kpi) => (
              <div key={kpi.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{kpi.label}</span>
                <span className={cn("font-semibold", kpi.color)}>{kpi.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold">Historial (6 meses)</h3>
          </div>
          {monthlyHistory.some((m) => m.ingresos > 0 || m.gastos > 0) ? (
            <div className="space-y-2">
              {monthlyHistory.map((m) => (
                <div key={m.month} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground w-8">{m.month}</span>
                    <span className="text-[10px] text-muted-foreground">{fmtMoney(m.ingresos)}</span>
                  </div>
                  <div className="flex gap-1 h-3">
                    <div title={`Ingresos: ${fmtMoney(m.ingresos)}`} className="h-full rounded gradient-bg" style={{ width: `${(m.ingresos / maxHistory) * 100}%` }} />
                    {m.gastos > 0 && (
                      <div title={`Gastos: ${fmtMoney(m.gastos)}`} className="h-full rounded bg-red-400/40" style={{ width: `${(m.gastos / maxHistory) * 100}%` }} />
                    )}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-4 text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border">
                <div className="flex items-center gap-1"><div className="h-2 w-2 rounded gradient-bg" /> Ingresos</div>
                <div className="flex items-center gap-1"><div className="h-2 w-2 rounded bg-red-400/40" /> Gastos</div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                <span>Total periodo: {fmtMoney(monthlyHistory.reduce((s, m) => s + m.ingresos, 0))} ingresos</span>
                <span>{fmtMoney(monthlyHistory.reduce((s, m) => s + m.gastos, 0))} gastos</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">Agrega datos mensuales para ver el historial</p>
          )}
        </div>

        {metaConnected && metaSummary ? (
          <a href="/dashboard/marketing" className="rounded-xl border border-border bg-card p-5 hover:border-primary/20 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <Megaphone className="h-4 w-4 text-purple-600" />
              <h3 className="text-sm font-semibold">Meta Ads</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: "Gasto", value: fmtMoney(metaSummary.spend) },
                { label: "Clics", value: fmt(metaSummary.clicks) },
                { label: "Impresiones", value: fmt(metaSummary.impressions) },
                { label: "Alcance", value: fmt(metaSummary.reach) },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-primary mt-3 flex items-center gap-1">
              Ver detalle completo <ArrowRight className="h-3 w-3" />
            </p>
          </a>
        ) : (
          <a href="/dashboard/integrations" className="rounded-xl border border-dashed border-border bg-card p-5 hover:border-primary/20 transition-colors flex flex-col items-center justify-center text-center">
            <Megaphone className="h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Conectar Meta Ads</p>
            <p className="text-xs text-muted-foreground mt-1">Ver métricas de tus campañas</p>
          </a>
        )}
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {[
          { href: "/dashboard/finance", icon: DollarSign, label: "Finanzas", value: fmtMoney(data.revenue), sub: "Ingresos del mes", color: "text-blue-600" },
          { href: "/dashboard/sales", icon: TrendingUp, label: "Ventas", value: fmtMoney(data.pipeline), sub: "Pipeline activo", color: "text-emerald-600" },
          { href: "/dashboard/hr", icon: Users, label: "Equipo", value: `${data.employees} personas`, sub: data.nomina > 0 ? `Nómina: ${fmtMoney(data.nomina)}` : "Ver detalle", color: "text-amber-600" },
        ].map((item) => (
          <a key={item.href} href={item.href} className="rounded-xl border border-border bg-card p-5 hover:border-primary/20 hover:shadow-sm transition-all">
            <div className="flex items-center gap-2 mb-1">
              <item.icon className={cn("h-4 w-4", item.color)} />
              <h3 className="text-sm font-semibold">{item.label}</h3>
            </div>
            <p className="text-xl font-bold sm:text-2xl">{item.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
          </a>
        ))}
      </div>

      <ActivityLog />
    </div>
  );
}
