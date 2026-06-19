"use client";

import { useEffect, useState } from "react";
import {
  DollarSign, TrendingUp, Users, ShoppingCart, RefreshCw, LinkIcon, Plus, ArrowRight,
  Target, Calculator, Download, Megaphone, BarChart3, Wallet, FileText, PlusCircle,
  SlidersHorizontal, Check, Sparkles,
} from "lucide-react";
import Link from "next/link";
import { MetricCard } from "@/components/dashboard/metric-card";
import { GoalProgress } from "@/components/dashboard/goal-progress";
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

// Catalog of widgets the user can show/hide on the overview.
const WIDGET_CATALOG: Array<{ id: string; label: string; requires?: "META_ADS" }> = [
  { id: "kpis", label: "Tarjetas KPI (Ingresos, Gastos, Equipo, Conversión)" },
  { id: "goals", label: "Metas con progreso" },
  { id: "calculated", label: "KPIs Calculados" },
  { id: "history", label: "Historial (6 meses)" },
  { id: "marketing", label: "Marketing / Meta Ads", requires: "META_ADS" },
  { id: "shortcuts", label: "Accesos rápidos por área" },
  { id: "activity", label: "Actividad reciente" },
];

const WIDGETS_KEY = "metrixpro-overview-widgets";

export default function OverviewPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [widgets, setWidgets] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(WIDGET_CATALOG.map((w) => [w.id, true]))
  );

  const load = async () => {
    try {
      const res = await fetch("/api/metrics/dashboard");
      if (res.ok) setData(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    load();
    try {
      const saved = localStorage.getItem(WIDGETS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, boolean>;
        setWidgets((prev) => ({ ...prev, ...parsed }));
      }
    } catch {}
  }, []);

  const toggleWidget = (id: string) => {
    setWidgets((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(WIDGETS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const show = (id: string) => widgets[id] !== false;

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

  if (!data || !data.hasData) {
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

  const { calculated: rawCalc, goals: rawGoals, monthlyHistory: rawHistory, metaSummary, metaConnected } = data;
  const calculated = rawCalc || { ytdRevenue: 0, ytdGastos: 0, annualProjection: 0, revenuePerEmployee: 0, utilidad: 0, margen: 0 };
  const goals = (Array.isArray(rawGoals) ? rawGoals : []).filter((g) => g.target > 0);
  const monthlyHistory = Array.isArray(rawHistory) ? rawHistory : [];
  const maxHistory = Math.max(...monthlyHistory.map((m) => Math.max(m.ingresos, m.gastos)), 1);

  // Whether the middle section (calculated/history/marketing) renders anything.
  const showMiddle = show("calculated") || show("history") || show("marketing");

  return (
    <div className="space-y-5">
      <div className="hidden lg:flex items-center gap-2 animate-fade-in-up">
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
            onClick={() => setCustomizing((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
              customizing ? "border-primary/40 bg-primary/5 text-primary" : "border-border bg-card hover:bg-secondary"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Personalizar</span>
          </button>
          <Link
            href="/dashboard/goals"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary"
          >
            <Target className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Metas</span>
          </Link>
          <button
            onClick={downloadMetrics}
            disabled={downloading}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{downloading ? "Descargando..." : "Exportar"}</span>
          </button>
          <button
            onClick={() => { setLoading(true); load(); }}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Customize panel */}
      {customizing && (
        <div className="rounded-xl border border-primary/20 bg-card p-4 sm:p-5 animate-slide-up">
          <div className="mb-3 flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">¿Qué quieres visualizar?</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {WIDGET_CATALOG.map((w) => {
              const enabled = show(w.id);
              return (
                <button
                  key={w.id}
                  onClick={() => toggleWidget(w.id)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-all",
                    enabled ? "border-primary/30 bg-primary/5" : "border-border bg-background hover:bg-secondary/50"
                  )}
                >
                  <span className={cn(enabled ? "text-foreground" : "text-muted-foreground")}>{w.label}</span>
                  <span className={cn(
                    "ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all",
                    enabled ? "border-primary gradient-bg text-white" : "border-border"
                  )}>
                    {enabled && <Check className="h-3 w-3" />}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Tus preferencias se guardan en este dispositivo.</p>
        </div>
      )}

      <Onboarding />

      {/* KPI cards */}
      {show("kpis") && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 stagger-children">
          <MetricCard title="Ingresos" value={data.revenue} change={data.revenueChange || undefined} icon={DollarSign} format="currency" />
          <MetricCard title="Gastos" value={data.gastos} change={data.gastosChange || undefined} icon={Wallet} format="currency" />
          <MetricCard title="Equipo" value={data.employees} change={data.employeesChange || undefined} icon={Users} format="number" />
          <MetricCard title="Conversión" value={data.conversion} change={data.conversionChange || undefined} icon={ShoppingCart} format="percentage" />
        </div>
      )}

      {/* Gamified goals */}
      {show("goals") && (
        goals.length > 0 ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" /> Tus metas
              </h3>
              <Link href="/dashboard/goals" className="text-xs font-medium text-primary hover:underline">Ver todas</Link>
            </div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
              {goals.slice(0, 4).map((g) => (
                <GoalProgress key={g.name} name={g.name} current={g.current} target={g.target} unit={g.unit} compact />
              ))}
            </div>
          </div>
        ) : (
          <Link href="/dashboard/goals" className="flex items-center justify-between rounded-xl border border-dashed border-border bg-card p-4 transition-colors hover:border-primary/30 card-hover">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Define tus metas</p>
                <p className="text-xs text-muted-foreground">Establece objetivos y sube de nivel al cumplirlos</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        )
      )}

      {/* Middle section: calculated KPIs, history, marketing */}
      {showMiddle && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {show("calculated") && (
            <div className="rounded-xl border border-border bg-card p-5 card-hover">
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
          )}

          {show("history") && (
            <div className="rounded-xl border border-border bg-card p-5 card-hover">
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
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">Agrega datos mensuales para ver el historial</p>
              )}
            </div>
          )}

          {show("marketing") && (
            metaConnected && metaSummary ? (
              <a href="/dashboard/marketing" className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/20 card-hover">
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
              <a href="/dashboard/integrations" className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-5 text-center transition-colors hover:border-primary/30 card-hover">
                <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <Megaphone className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-semibold">Falta conectar tu publicidad</p>
                <p className="mt-1 text-xs text-muted-foreground">Conecta Meta o Google Ads para ver el rendimiento de tus campañas aquí.</p>
                <span className="mt-3 inline-flex items-center gap-1 rounded-lg gradient-bg px-3 py-1.5 text-xs font-medium text-white">
                  Conectar ahora <ArrowRight className="h-3 w-3" />
                </span>
              </a>
            )
          )}
        </div>
      )}

      {/* Area shortcuts */}
      {show("shortcuts") && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 stagger-children">
          {[
            { href: "/dashboard/finance", icon: DollarSign, label: "Finanzas", value: fmtMoney(data.revenue), sub: "Ingresos del mes", color: "text-blue-600" },
            { href: "/dashboard/sales", icon: TrendingUp, label: "Ventas", value: fmtMoney(data.pipeline), sub: "Pipeline activo", color: "text-emerald-600" },
            { href: "/dashboard/hr", icon: Users, label: "Equipo", value: `${data.employees} personas`, sub: data.nomina > 0 ? `Nómina: ${fmtMoney(data.nomina)}` : "Ver detalle", color: "text-amber-600" },
          ].map((item) => (
            <a key={item.href} href={item.href} className="rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/20 card-hover">
              <div className="flex items-center gap-2 mb-1">
                <item.icon className={cn("h-4 w-4", item.color)} />
                <h3 className="text-sm font-semibold">{item.label}</h3>
              </div>
              <p className="text-xl font-bold sm:text-2xl">{item.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
            </a>
          ))}
        </div>
      )}

      {show("activity") && <ActivityLog />}
    </div>
  );
}
