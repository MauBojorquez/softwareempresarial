"use client";

import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, Users, ShoppingCart, ArrowUpRight, ArrowDownRight, Sparkles, RefreshCw } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { SalesPipelineChart } from "@/components/charts/sales-pipeline-chart";

type DashboardData = {
  revenue: number;
  revenueChange: number;
  pipeline: number;
  pipelineChange: number;
  employees: number;
  employeesChange: number;
  conversion: number;
  conversionChange: number;
};

const defaults: DashboardData = {
  revenue: 0, revenueChange: 0,
  pipeline: 0, pipelineChange: 0,
  employees: 0, employeesChange: 0,
  conversion: 0, conversionChange: 0,
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
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Resumen ejecutivo de tu negocio</p>
        </div>
        <button
          onClick={() => { setLoading(true); load(); }}
          className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-medium transition-colors hover:bg-white/10"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Ingresos del Mes" value={data.revenue} change={data.revenueChange} icon={DollarSign} format="currency" />
        <MetricCard title="Pipeline Activo" value={data.pipeline} change={data.pipelineChange} icon={TrendingUp} format="currency" />
        <MetricCard title="Empleados Activos" value={data.employees} change={data.employeesChange} icon={Users} format="number" />
        <MetricCard title="Tasa de Conversión" value={data.conversion} change={data.conversionChange} icon={ShoppingCart} format="percentage" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueChart />
        <SalesPipelineChart />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-card p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold">Actividad Reciente</h3>
          <div className="mt-4 space-y-4">
            {[
              { text: "Nuevo deal cerrado: Proyecto Alpha", amount: 180000, positive: true },
              { text: "Pago recibido: Factura #2847", amount: 45000, positive: true },
              { text: "Gasto registrado: Nómina quincenal", amount: -320000, positive: false },
              { text: "Nuevo lead calificado: Empresa XYZ", amount: 95000, positive: true },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-1.5 ${item.positive ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                    {item.positive ? (
                      <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
                    )}
                  </div>
                  <span className="text-sm">{item.text}</span>
                </div>
                <span className={`text-sm font-medium ${item.positive ? "text-emerald-400" : "text-red-400"}`}>
                  {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-card p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-semibold">Reporte IA</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Último reporte mensual</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs font-medium text-primary">Insight Principal</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Los ingresos crecieron 10.7% vs mes anterior, impulsados por 3 deals enterprise cerrados.
              </p>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-xs font-medium text-amber-400">Alerta</p>
              <p className="mt-1 text-sm text-muted-foreground">
                La tasa de conversión bajó 2.1%. Revisar proceso de calificación de leads.
              </p>
            </div>
          </div>
          <button className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/10">
            Ver reporte completo
          </button>
        </div>
      </div>
    </div>
  );
}
