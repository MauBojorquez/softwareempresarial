"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const demoData = [
  { month: "Ene", ingresos: 420000, gastos: 310000 },
  { month: "Feb", ingresos: 480000, gastos: 320000 },
  { month: "Mar", ingresos: 510000, gastos: 340000 },
  { month: "Abr", ingresos: 470000, gastos: 290000 },
  { month: "May", ingresos: 560000, gastos: 350000 },
  { month: "Jun", ingresos: 620000, gastos: 360000 },
];

export function RevenueChart() {
  return (
    <div className="rounded-xl border bg-card p-6">
      <h3 className="text-lg font-semibold">Ingresos vs Gastos</h3>
      <p className="text-sm text-muted-foreground">Últimos 6 meses</p>
      <div className="mt-4 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={demoData}>
            <defs>
              <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" className="text-xs" />
            <YAxis className="text-xs" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number) =>
                new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value)
              }
            />
            <Area
              type="monotone"
              dataKey="ingresos"
              stroke="hsl(221, 83%, 53%)"
              fillOpacity={1}
              fill="url(#colorIngresos)"
              name="Ingresos"
            />
            <Area
              type="monotone"
              dataKey="gastos"
              stroke="hsl(0, 84%, 60%)"
              fillOpacity={1}
              fill="url(#colorGastos)"
              name="Gastos"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
