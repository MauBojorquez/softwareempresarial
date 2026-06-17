import { DollarSign, TrendingUp, Users, ShoppingCart, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { SalesPipelineChart } from "@/components/charts/sales-pipeline-chart";

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Resumen ejecutivo de tu negocio
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Ingresos del Mes"
          value={620000}
          change={10.7}
          icon={DollarSign}
          format="currency"
        />
        <MetricCard
          title="Pipeline Activo"
          value={7410000}
          change={5.2}
          icon={TrendingUp}
          format="currency"
        />
        <MetricCard
          title="Empleados Activos"
          value={48}
          change={4.3}
          icon={Users}
          format="number"
        />
        <MetricCard
          title="Tasa de Conversión"
          value={17.8}
          change={-2.1}
          icon={ShoppingCart}
          format="percentage"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueChart />
        <SalesPipelineChart />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold">Actividad Reciente</h3>
          <div className="mt-4 space-y-4">
            {[
              { text: "Nuevo deal cerrado: Proyecto Alpha", amount: 180000, positive: true },
              { text: "Pago recibido: Factura #2847", amount: 45000, positive: true },
              { text: "Gasto registrado: Nómina quincenal", amount: -320000, positive: false },
              { text: "Nuevo lead calificado: Empresa XYZ", amount: 95000, positive: true },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between border-b pb-3 last:border-0">
                <div className="flex items-center gap-3">
                  {item.positive ? (
                    <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-sm">{item.text}</span>
                </div>
                <span className={`text-sm font-medium ${item.positive ? "text-emerald-600" : "text-destructive"}`}>
                  {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-lg font-semibold">Reporte IA</h3>
          <p className="mt-1 text-sm text-muted-foreground">Último reporte mensual</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg bg-primary/5 p-3">
              <p className="text-xs font-medium text-primary">Insight Principal</p>
              <p className="mt-1 text-sm">
                Los ingresos crecieron 10.7% vs mes anterior, impulsados por 3 deals enterprise cerrados.
              </p>
            </div>
            <div className="rounded-lg bg-amber-500/5 p-3">
              <p className="text-xs font-medium text-amber-600">Alerta</p>
              <p className="mt-1 text-sm">
                La tasa de conversión bajó 2.1%. Revisar proceso de calificación de leads.
              </p>
            </div>
          </div>
          <button className="mt-4 w-full rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent">
            Ver reporte completo
          </button>
        </div>
      </div>
    </div>
  );
}
