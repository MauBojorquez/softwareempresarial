"use client";

import { useEffect, useState, useRef } from "react";
import {
  DollarSign, TrendingUp, TrendingDown, Users, ShoppingCart, RefreshCw, LinkIcon, Plus, ArrowRight,
  Target, Calculator, Download, Megaphone, BarChart3, Wallet, FileText, PlusCircle,
  SlidersHorizontal, Check, Sparkles, Receipt, Building2, ChevronDown, GripVertical, Landmark,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { GoalProgress } from "@/components/dashboard/goal-progress";
import { cn, formatCurrency } from "@/lib/utils";
import { Onboarding } from "@/components/dashboard/onboarding";
import { ActivityLog } from "@/components/dashboard/activity-log";
import { InsightsWidget } from "@/components/dashboard/insights-widget";
import { useToast } from "@/components/toast";
import { DashboardSkeleton } from "@/components/dashboard/skeleton";

type DashboardData = {
  satIngresos: number; satIngresosChange: number;
  satEgresos: number; satEgresosChange: number;
  satBalance: number; satIva: number;
  satConnected: boolean;
  cajaConnected: boolean; cajaBalance: number;
  cajaDeposits: number; cajaDepositsChange: number;
  cajaWithdrawals: number; cajaWithdrawalsChange: number;
  ventas: number; ventasChange: number;
  pipeline: number; pipelineChange: number;
  leads: number; leadsChange: number;
  conversion: number; conversionChange: number;
  employees: number; employeesChange: number;
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

type OrgItem = { id: string; name: string; logo?: string | null; isActive: boolean };

const fmtMoney = formatCurrency;
const fmt = (v: number) => new Intl.NumberFormat("es-MX").format(Math.round(v));

const WIDGET_CATALOG: Array<{ id: string; label: string }> = [
  { id: "fiscal", label: "Finanzas Fiscales (SAT)" },
  { id: "caja", label: "Flujo de Efectivo (Caja)" },
  { id: "crm", label: "CRM — Ventas y Pipeline" },
  { id: "insights", label: "IA Proactiva (alertas + proyección)" },
  { id: "goals", label: "Metas con progreso" },
  { id: "calculated", label: "KPIs Calculados" },
  { id: "history", label: "Historial (6 meses)" },
  { id: "marketing", label: "Marketing / Meta Ads" },
  { id: "hr", label: "Equipo / RRHH" },
  { id: "shortcuts", label: "Accesos rápidos" },
  { id: "activity", label: "Actividad reciente" },
];

const DEFAULT_ORDER = WIDGET_CATALOG.map((w) => w.id);
const WIDGETS_KEY = "metrixpro-overview-widgets-v2";
const ORDER_KEY = "metrixpro-overview-order-v1";

/**
 * Builds a list of motivational, *data-aware* one-liners for the welcome card.
 * Contextual lines (real wins from the data) come first; a few evergreen
 * lines are always appended so there is never an empty list. A random one is
 * shown each load so the dashboard feels alive without ever lying about a number.
 */
function buildMotivationalLines(firstName: string, data: DashboardData): string[] {
  const lines: string[] = [];
  const goals = (Array.isArray(data.goals) ? data.goals : []).filter((g) => g.target > 0);
  const c = data.calculated;

  // 1. A goal already crossed the finish line.
  const completed = goals.find((g) => g.current >= g.target);
  if (completed) lines.push(`¡Cumpliste tu meta de ${completed.name}, ${firstName}! Eso se celebra. 🎉`);

  // 2. The goal closest to completion (≥60%, not done yet).
  const close = goals
    .filter((g) => g.current < g.target)
    .map((g) => ({ name: g.name, pct: (g.current / g.target) * 100 }))
    .filter((g) => g.pct >= 60)
    .sort((a, b) => b.pct - a.pct)[0];
  if (close) lines.push(`Vas al ${close.pct.toFixed(0)}% de tu meta de ${close.name}. ¡Ya casi la cierras! 🔥`);

  // 3. Real growth signals.
  if (data.satIngresosChange > 0)
    lines.push(`Tus ingresos crecieron ${data.satIngresosChange.toFixed(1)}% vs el mes pasado. Vas con todo, ${firstName}. 📈`);
  if (data.ventasChange > 0)
    lines.push(`Tus ventas subieron ${data.ventasChange.toFixed(1)}% este mes. ¡Sigue empujando! 🚀`);
  if (c && c.margen > 15)
    lines.push(`Tu margen neto es de ${c.margen}%. Finanzas sólidas, ${firstName}. 💪`);
  if (c && c.annualProjection > 0)
    lines.push(`Si mantienes el ritmo, cerrarás el año cerca de ${formatCurrency(c.annualProjection)}. 🎯`);

  // 4. Evergreen motivation — always available so the list is never empty.
  lines.push(
    `Las empresas que miden, crecen. Y tú estás midiendo, ${firstName}. 👏`,
    `Cada dato que registras hoy es una mejor decisión mañana.`,
    `Tienes el control de tus números, ${firstName}. Eso ya te pone adelante.`,
    `Pequeñas mejoras cada mes se vuelven grandes resultados al año.`,
  );

  return lines;
}

export default function OverviewPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [widgets, setWidgets] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(WIDGET_CATALOG.map((w) => [w.id, true]))
  );
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [dragId, setDragId] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const orgDropdownRef = useRef<HTMLDivElement>(null);
  // Stable random seed per page load so the motivational line doesn't change on
  // every re-render, but rotates whenever the user reloads/refreshes.
  const motivSeed = useRef(Math.random());

  const load = async () => {
    try {
      const res = await fetch("/api/metrics/dashboard");
      if (res.ok) setData(await res.json());
      else toast("Error al cargar el dashboard", "error");
    } catch { toast("Error de conexión", "error"); }
    setLoading(false);
  };

  useEffect(() => {
    load();
    try {
      const saved = localStorage.getItem(WIDGETS_KEY);
      if (saved) setWidgets((prev) => ({ ...prev, ...JSON.parse(saved) }));
      const savedOrder = localStorage.getItem(ORDER_KEY);
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder) as string[];
        // keep only known ids, append any new ones not yet stored
        const merged = parsed.filter((id) => DEFAULT_ORDER.includes(id));
        for (const id of DEFAULT_ORDER) if (!merged.includes(id)) merged.push(id);
        setOrder(merged);
      }
    } catch {}

    fetch("/api/organizations").then((r) => r.json()).then((d) => {
      if (Array.isArray(d.organizations)) setOrgs(d.organizations);
    }).catch(() => {});

    const handleClickOutside = (e: MouseEvent) => {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(e.target as Node)) {
        setShowOrgDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleWidget = (id: string) => {
    setWidgets((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(WIDGETS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const persistOrder = (next: string[]) => {
    setOrder(next);
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)); } catch {}
  };

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const next = [...order];
    const from = next.indexOf(dragId);
    const to = next.indexOf(targetId);
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    persistOrder(next);
    setDragId(null);
  };

  const switchOrg = async (orgId: string) => {
    setShowOrgDropdown(false);
    await fetch("/api/organizations/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    });
    window.location.reload();
  };

  const show = (id: string) => widgets[id] !== false;

  const downloadMetrics = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/reports/pdf?type=metrics");
      if (!res.ok) {
        toast("No se pudo exportar las métricas", "error");
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Metricas-${new Date().toISOString().split("T")[0]}.html`;
        a.click();
        URL.revokeObjectURL(url);
        toast("Métricas exportadas", "success");
      }
    } catch {
      toast("Error al exportar métricas", "error");
    }
    setDownloading(false);
  };

  if (loading) return <DashboardSkeleton />;

  if (!data || !data.hasData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Resumen ejecutivo de tu negocio</p>
        </div>
        <Onboarding />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Ingresos SAT" value={0} icon={Receipt} format="currency" />
          <MetricCard title="Ventas CRM" value={0} icon={TrendingUp} format="currency" />
          <MetricCard title="Pipeline" value={0} icon={DollarSign} format="currency" />
          <MetricCard title="Leads" value={0} icon={Users} format="number" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 overflow-hidden">
          <div className="w-full h-1 gradient-bg rounded-t-xl -mt-[25px] sm:-mt-[33px] mb-6" />
          <div className="flex flex-col items-center justify-center text-center">
            <LinkIcon className="h-8 w-8 text-muted-foreground mb-3 sm:h-10 sm:w-10 sm:mb-4" />
            <h3 className="text-base font-semibold sm:text-lg">Comienza a agregar tus datos</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-lg">
              Conecta el SAT para datos fiscales o agrega ventas y leads de tu CRM.
            </p>
            <div className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-3 w-full max-w-xl">
              {[
                { href: "/dashboard/integrations/sat", icon: Receipt, label: "Conectar SAT", color: "text-blue-600" },
                { href: "/dashboard/sales", icon: TrendingUp, label: "Ventas / CRM", color: "text-emerald-600" },
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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const firstName = session?.user?.name?.split(" ")[0] ?? "Bienvenido";
  const dateStr = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  const activeOrg = orgs.find((o) => o.isActive);

  const motivLines = buildMotivationalLines(firstName, data);
  const motivLine = motivLines[Math.floor(motivSeed.current * motivLines.length)] ?? motivLines[0];

  // ── Each widget as a renderable section, keyed by id ──
  const sections: Record<string, React.ReactNode> = {
    fiscal: (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-foreground">Finanzas Fiscales</h3>
            {data.satConnected ? (
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600">Fuente: SAT</span>
            ) : (
              <a href="/dashboard/integrations/sat" className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 hover:underline">Conectar SAT</a>
            )}
          </div>
          <a href="/dashboard/finance" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">Ver detalle <ArrowRight className="h-3 w-3" /></a>
        </div>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 stagger-children">
          <MetricCard title="Ingresos" value={data.satIngresos} change={data.satIngresosChange || undefined} icon={DollarSign} format="currency" />
          <MetricCard title="Egresos" value={data.satEgresos} change={data.satEgresosChange || undefined} icon={Wallet} format="currency" />
          <MetricCard title="Balance Fiscal" value={data.satBalance} icon={Calculator} format="currency" />
          <MetricCard title="IVA Cobrado" value={data.satIva} icon={Receipt} format="currency" />
        </div>
      </div>
    ),
    caja: data.cajaConnected ? (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-[#3D7FFF]" />
            <h3 className="text-sm font-semibold text-foreground">Flujo de Efectivo</h3>
            <span className="rounded-full bg-[#3D7FFF]/10 px-2 py-0.5 text-[10px] font-medium text-[#3D7FFF]">Caja real (bancos)</span>
          </div>
          <a href="/dashboard/finance/cashflow" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">Ver detalle <ArrowRight className="h-3 w-3" /></a>
        </div>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 stagger-children">
          <MetricCard title="Saldo en Bancos" value={data.cajaBalance} icon={Landmark} format="currency" />
          <MetricCard title="Depósitos (mes)" value={data.cajaDeposits} change={data.cajaDepositsChange || undefined} icon={TrendingUp} format="currency" />
          <MetricCard title="Retiros (mes)" value={data.cajaWithdrawals} change={data.cajaWithdrawalsChange || undefined} icon={TrendingDown} format="currency" />
          <MetricCard title="Flujo Neto (mes)" value={data.cajaDeposits - data.cajaWithdrawals} icon={Wallet} format="currency" />
        </div>
      </div>
    ) : null,
    crm: (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-foreground">CRM — Ventas</h3>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">HubSpot / Manual</span>
          </div>
          <a href="/dashboard/sales" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">Ver detalle <ArrowRight className="h-3 w-3" /></a>
        </div>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 stagger-children">
          <MetricCard title="Ventas" value={data.ventas} change={data.ventasChange || undefined} icon={ShoppingCart} format="currency" />
          <MetricCard title="Pipeline" value={data.pipeline} change={data.pipelineChange || undefined} icon={TrendingUp} format="currency" />
          <MetricCard title="Nuevos Leads" value={data.leads} change={data.leadsChange || undefined} icon={Users} format="number" />
          <MetricCard title="Conversión" value={data.conversion} change={data.conversionChange || undefined} icon={Target} format="percentage" />
        </div>
      </div>
    ),
    insights: <InsightsWidget />,
    goals: goals.length > 0 ? (
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
      <Link href="/dashboard/goals" className="flex items-center justify-between rounded-2xl border border-dashed border-border bg-card p-4 transition-colors hover:border-primary/30 card-hover">
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
    ),
    calculated: (
      <div className="rounded-2xl border border-border bg-card p-5 card-hover">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold">KPIs Calculados</h3>
        </div>
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {[
            { label: "Facturación Anual (YTD)", value: fmtMoney(calculated.ytdRevenue) },
            { label: "Proyección Anual", value: fmtMoney(calculated.annualProjection) },
            { label: "Ingreso por Colaborador", value: data.employees > 0 ? fmtMoney(calculated.revenuePerEmployee) : "—" },
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
    ),
    history: (
      <div className="rounded-2xl border border-border bg-card p-5 card-hover">
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
                  {m.gastos > 0 && <div title={`Gastos: ${fmtMoney(m.gastos)}`} className="h-full rounded bg-red-400/40" style={{ width: `${(m.gastos / maxHistory) * 100}%` }} />}
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
    ),
    marketing: metaConnected && metaSummary ? (
      <a href="/dashboard/marketing" className="block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/20 card-hover">
        <div className="flex items-center gap-2 mb-3">
          <Megaphone className="h-4 w-4 text-purple-600" />
          <h3 className="text-sm font-semibold">Meta Ads</h3>
        </div>
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
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
      </a>
    ) : (
      <a href="/dashboard/integrations" className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-5 text-center transition-colors hover:border-primary/30 card-hover">
        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <Megaphone className="h-5 w-5 text-primary" />
        </div>
        <p className="text-sm font-semibold">Campañas / Meta Ads</p>
        <p className="mt-1 text-xs text-muted-foreground">Conecta Meta Ads para ver el rendimiento de tus campañas.</p>
        <span className="mt-3 inline-flex items-center gap-1 rounded-lg gradient-bg px-3 py-1.5 text-xs font-medium text-white">Conectar <ArrowRight className="h-3 w-3" /></span>
      </a>
    ),
    hr: (
      <div className="rounded-2xl border border-border bg-card p-5 card-hover">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold">Equipo / RRHH</h3>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">Manual</span>
          </div>
          <a href="/dashboard/hr" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">Ver <ArrowRight className="h-3 w-3" /></a>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold">{fmt(data.employees)}</p>
            <p className="text-xs text-muted-foreground">Colaboradores</p>
          </div>
          {data.nomina > 0 && (
            <div>
              <p className="text-2xl font-bold">{fmtMoney(data.nomina)}</p>
              <p className="text-xs text-muted-foreground">Nómina mensual</p>
            </div>
          )}
        </div>
      </div>
    ),
    shortcuts: (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 stagger-children">
        {[
          { href: "/dashboard/finance", icon: DollarSign, label: "Finanzas", value: fmtMoney(data.satIngresos), sub: data.satConnected ? "Ingresos SAT" : "Ingresos del mes", color: "text-blue-600" },
          { href: "/dashboard/sales", icon: TrendingUp, label: "Ventas", value: fmtMoney(data.pipeline), sub: "Pipeline activo", color: "text-emerald-600" },
          { href: "/dashboard/hr", icon: Users, label: "Equipo", value: `${data.employees} personas`, sub: data.nomina > 0 ? `Nómina: ${fmtMoney(data.nomina)}` : "Ver detalle", color: "text-amber-600" },
        ].map((item) => (
          <a key={item.href} href={item.href} className="rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/20 card-hover">
            <div className="flex items-center gap-2 mb-1">
              <item.icon className={cn("h-4 w-4", item.color)} />
              <h3 className="text-sm font-semibold">{item.label}</h3>
            </div>
            <p className="text-xl font-bold sm:text-2xl">{item.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
          </a>
        ))}
      </div>
    ),
    activity: <ActivityLog />,
  };

  return (
    <div className="space-y-5">
      {/* Aurora welcome banner */}
      <div className="relative overflow-hidden rounded-2xl aurora p-5 text-white shadow-lg shadow-primary/20 animate-fade-in-up sm:p-6">
        <div className="aurora-shine pointer-events-none absolute inset-0" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-white/80">{greeting},</p>
            <h2 className="text-xl font-bold sm:text-2xl">{firstName} 👋</h2>
            <p key={motivLine} className="mt-1.5 max-w-md text-sm font-medium leading-snug text-white/90 animate-fade-in-up">
              {motivLine}
            </p>
            <p className="mt-2 text-xs capitalize text-white/70">{dateStr}</p>
          </div>
          <div className="hidden shrink-0 flex-col items-end sm:flex">
            <p className="text-2xl font-bold tabular-nums">{fmtMoney(data.satIngresos || data.ventas || 0)}</p>
            <p className="text-xs text-white/75">{data.satConnected ? "Ingresos fiscales (SAT)" : "Ventas del mes"}</p>
            {calculated.ytdRevenue > 0 && (
              <p className="mt-2 text-sm font-semibold tabular-nums text-white/90">{fmtMoney(calculated.ytdRevenue)}</p>
            )}
            {calculated.ytdRevenue > 0 && <p className="text-[11px] text-white/70">Acumulado del año</p>}
          </div>
        </div>
      </div>

      {/* Multi-company switcher */}
      {orgs.length > 1 && (
        <div ref={orgDropdownRef} className="relative inline-block">
          <button onClick={() => setShowOrgDropdown((v) => !v)} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary transition-colors">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span>{activeOrg?.name || "Empresa"}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", showOrgDropdown && "rotate-180")} />
          </button>
          {showOrgDropdown && (
            <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-2xl border border-border bg-card shadow-lg">
              {orgs.map((org) => (
                <button key={org.id} onClick={() => switchOrg(org.id)} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-secondary transition-colors first:rounded-t-xl last:rounded-b-xl">
                  {org.logo ? (
                    <img src={org.logo} alt="" className="h-5 w-5 rounded object-contain border border-border bg-secondary" />
                  ) : (
                    <div className="h-5 w-5 rounded gradient-bg flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-white">{org.name[0]?.toUpperCase()}</span>
                    </div>
                  )}
                  <span className="flex-1 truncate text-left">{org.name}</span>
                  {org.isActive && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="hidden lg:flex items-center gap-2 animate-fade-in-up">
        <a href="/dashboard/sales" className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary">
          <PlusCircle className="h-3.5 w-3.5" />Agregar venta
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
          <button onClick={() => setCustomizing((v) => !v)} className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors", customizing ? "border-primary/40 bg-primary/5 text-primary" : "border-border bg-card hover:bg-secondary")}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Personalizar</span>
          </button>
          <Link href="/dashboard/goals" className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary">
            <Target className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Metas</span>
          </Link>
          <button onClick={downloadMetrics} disabled={downloading} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{downloading ? "Descargando..." : "Exportar"}</span>
          </button>
          <button onClick={() => { setLoading(true); load(); }} aria-label="Actualizar" className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Customize panel — toggle + drag to reorder */}
      {customizing && (
        <div className="rounded-2xl border border-primary/20 bg-card p-4 sm:p-5 animate-slide-up">
          <div className="mb-3 flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Personaliza tu dashboard</h3>
          </div>
          <p className="mb-3 text-[11px] text-muted-foreground">Activa/desactiva secciones y arrástralas para reordenarlas.</p>
          <div className="space-y-2">
            {order.map((id) => {
              const w = WIDGET_CATALOG.find((x) => x.id === id);
              if (!w) return null;
              const enabled = show(id);
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={() => setDragId(id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-all",
                    dragId === id ? "opacity-50" : "",
                    enabled ? "border-primary/30 bg-primary/5" : "border-border bg-background"
                  )}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                  <span className={cn("flex-1 text-sm", enabled ? "text-foreground" : "text-muted-foreground")}>{w.label}</span>
                  <button
                    onClick={() => toggleWidget(id)}
                    className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all", enabled ? "border-primary gradient-bg text-white" : "border-border")}
                    aria-label={enabled ? "Ocultar" : "Mostrar"}
                  >
                    {enabled && <Check className="h-3 w-3" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Onboarding />

      {/* Render sections in user-defined order */}
      {order.map((id) => (show(id) && sections[id] ? <div key={id}>{sections[id]}</div> : null))}
    </div>
  );
}
