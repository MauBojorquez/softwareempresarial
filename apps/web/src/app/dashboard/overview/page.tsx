"use client";

import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, Users, ShoppingCart, Sparkles, RefreshCw, LinkIcon, Plus, ArrowRight } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";

type DashboardData = {
  revenue: number;
  revenueChange: number;
  pipeline: number;
  pipelineChange: number;
  employees: number;
  employeesChange: number;
  conversion: number;
  conversionChange: number;
  hasData: boolean;
};

const defaults: DashboardData = {
  revenue: 0, revenueChange: 0,
  pipeline: 0, pipelineChange: 0,
  employees: 0, employeesChange: 0,
  conversion: 0, conversionChange: 0,
  hasData: false,
};

export default function OverviewPage() {
  const [data, setData] = useState<DashboardData>(defaults);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch("/api/metrics/dashboard");
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Resumen ejecutivo de tu negocio</p>
        </div>
        <button
          onClick={() => { setLoading(true); load(); }}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {!data.hasData ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Ingresos del Mes" value={0} icon={DollarSign} format="currency" />
            <MetricCard title="Pipeline Activo" value={0} icon={TrendingUp} format="currency" />
            <MetricCard title="Empleados Activos" value={0} icon={Users} format="number" />
            <MetricCard title="Tasa de Conversión" value={0} icon={ShoppingCart} format="percentage" />
          </div>

          <div className="rounded-xl border border-border bg-card p-8">
            <div className="flex flex-col items-center justify-center text-center">
              <LinkIcon className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Comienza a agregar tus datos</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-lg">
                Tu dashboard se llenará automáticamente cuando conectes integraciones o registres datos manualmente en cada sección.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3 w-full max-w-xl">
                <a href="/dashboard/finance" className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                    <span>Finanzas</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
                <a href="/dashboard/sales" className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    <span>Ventas</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
                <a href="/dashboard/integrations" className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-purple-600" />
                    <span>Integraciones</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Ingresos del Mes" value={data.revenue} change={data.revenueChange || undefined} icon={DollarSign} format="currency" />
            <MetricCard title="Pipeline Activo" value={data.pipeline} change={data.pipelineChange || undefined} icon={TrendingUp} format="currency" />
            <MetricCard title="Empleados Activos" value={data.employees} change={data.employeesChange || undefined} icon={Users} format="number" />
            <MetricCard title="Tasa de Conversión" value={data.conversion} change={data.conversionChange || undefined} icon={ShoppingCart} format="percentage" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <a href="/dashboard/finance" className="rounded-xl border border-border bg-card p-6 hover:border-primary/20 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <h3 className="font-semibold">Finanzas</h3>
              </div>
              <p className="text-2xl font-bold">{new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(data.revenue)}</p>
              <p className="text-xs text-muted-foreground mt-1">Ingresos del mes</p>
            </a>
            <a href="/dashboard/sales" className="rounded-xl border border-border bg-card p-6 hover:border-primary/20 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <h3 className="font-semibold">Ventas</h3>
              </div>
              <p className="text-2xl font-bold">{new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(data.pipeline)}</p>
              <p className="text-xs text-muted-foreground mt-1">Pipeline activo</p>
            </a>
            <a href="/dashboard/marketing" className="rounded-xl border border-border bg-card p-6 hover:border-primary/20 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <h3 className="font-semibold">Marketing</h3>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Ver métricas de Meta Ads</p>
            </a>
          </div>
        </>
      )}
    </div>
  );
}
