import { Users, UserPlus, UserMinus, Heart } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";

export default function HRPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recursos Humanos</h1>
        <p className="text-sm text-muted-foreground">Métricas de equipo</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Headcount" value={48} change={4.3} icon={Users} format="number" />
        <MetricCard title="Nuevas Contrataciones" value={3} icon={UserPlus} format="number" />
        <MetricCard title="Rotación" value={2.1} change={-15.0} icon={UserMinus} format="percentage" />
        <MetricCard title="Satisfacción" value="8.4/10" icon={Heart} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-card p-6">
          <h3 className="text-lg font-semibold">Distribución por Departamento</h3>
          <div className="mt-4 space-y-3">
            {[
              { dept: "Ventas", count: 12, pct: 25, color: "from-blue-500 to-blue-600" },
              { dept: "Operaciones", count: 15, pct: 31, color: "from-purple-500 to-purple-600" },
              { dept: "Tecnología", count: 10, pct: 21, color: "from-cyan-500 to-cyan-600" },
              { dept: "Administración", count: 6, pct: 12.5, color: "from-amber-500 to-amber-600" },
              { dept: "Marketing", count: 5, pct: 10.5, color: "from-pink-500 to-pink-600" },
            ].map((item, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{item.dept}</span>
                  <span className="text-muted-foreground">{item.count} ({item.pct}%)</span>
                </div>
                <div className="h-2 rounded-full bg-white/5">
                  <div className={`h-2 rounded-full bg-gradient-to-r ${item.color}`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-card p-6">
          <h3 className="text-lg font-semibold">Costo de Nómina</h3>
          <div className="mt-4">
            <p className="text-3xl font-bold">
              {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(980000)}
            </p>
            <p className="text-sm text-muted-foreground">Mensual</p>
            <div className="mt-4 space-y-2">
              {[
                { label: "Salarios base", value: "$720,000", pct: 73 },
                { label: "Prestaciones", value: "$180,000", pct: 18 },
                { label: "Comisiones", value: "$80,000", pct: 9 },
              ].map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
