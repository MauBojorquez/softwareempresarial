import { DollarSign, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { RevenueChart } from "@/components/charts/revenue-chart";

export default function FinancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Finanzas</h1>
        <p className="text-sm text-muted-foreground">Métricas financieras de QuickBooks</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Ingresos" value={620000} change={10.7} icon={DollarSign} format="currency" />
        <MetricCard title="Gastos" value={360000} change={2.9} icon={TrendingDown} format="currency" />
        <MetricCard title="Utilidad Neta" value={260000} change={22.4} icon={Wallet} format="currency" />
        <MetricCard title="Margen Neto" value={41.9} change={4.2} icon={PiggyBank} format="percentage" />
      </div>

      <RevenueChart />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-lg font-semibold">Cuentas por Cobrar</h3>
          <div className="mt-4 space-y-3">
            {[
              { client: "Empresa ABC", amount: 85000, days: 15 },
              { client: "Corp XYZ", amount: 120000, days: 30 },
              { client: "Tech Solutions", amount: 45000, days: 7 },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between border-b pb-3 last:border-0">
                <div>
                  <p className="text-sm font-medium">{item.client}</p>
                  <p className="text-xs text-muted-foreground">Vence en {item.days} días</p>
                </div>
                <span className="text-sm font-semibold">
                  {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-lg font-semibold">Flujo de Caja</h3>
          <div className="mt-4">
            <p className="text-3xl font-bold text-emerald-600">
              {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(1850000)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Balance disponible</p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Entradas del mes</span>
                <span className="font-medium text-emerald-600">+$620,000</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Salidas del mes</span>
                <span className="font-medium text-destructive">-$360,000</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
