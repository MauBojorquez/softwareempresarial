import { Users, UserPlus, UserMinus, Clock } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";

export default function HRPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recursos Humanos</h1>
        <p className="text-sm text-muted-foreground">Métricas de equipo</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Headcount" value={48} change={4.3} icon={Users} format="number" />
        <MetricCard title="Nuevas Contrataciones" value={3} icon={UserPlus} format="number" />
        <MetricCard title="Rotación" value={2.1} change={-15.0} icon={UserMinus} format="percentage" />
        <MetricCard title="Satisfacción" value={8.4} icon={Clock} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-lg font-semibold">Distribución por Departamento</h3>
          <div className="mt-4 space-y-3">
            {[
              { dept: "Ventas", count: 12, pct: 25 },
              { dept: "Operaciones", count: 15, pct: 31 },
              { dept: "Tecnología", count: 10, pct: 21 },
              { dept: "Administración", count: 6, pct: 12.5 },
              { dept: "Marketing", count: 5, pct: 10.5 },
            ].map((item, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{item.dept}</span>
                  <span className="text-muted-foreground">{item.count} ({item.pct}%)</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-lg font-semibold">Costo de Nómina</h3>
          <div className="mt-4">
            <p className="text-3xl font-bold">
              {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(980000)}
            </p>
            <p className="text-sm text-muted-foreground">Mensual</p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Salarios base</span>
                <span>$720,000</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Prestaciones</span>
                <span>$180,000</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Comisiones</span>
                <span>$80,000</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
