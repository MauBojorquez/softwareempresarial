"use client";

import {
  LineChart,
  Line,
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

const CustomDot = (props: any) => {
  const { cx, cy, stroke } = props;
  if (!cx || !cy) return null;
  return <circle cx={cx} cy={cy} r={3} fill={stroke} stroke="rgba(0,0,0,0.6)" strokeWidth={1.5} />;
};

export function RevenueChart() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Ingresos vs Gastos</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Últimos 6 meses</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 inline-block rounded-full" style={{ background: "#3D7FFF", boxShadow: "0 0 6px #3D7FFF" }} />
            Ingresos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 inline-block rounded-full" style={{ background: "#FF4444", boxShadow: "0 0 6px #FF4444" }} />
            Gastos
          </span>
        </div>
      </div>
      <div
        className="h-[220px]"
        role="img"
        aria-label="Gráfica de líneas estilo trading de ingresos contra gastos en los últimos 6 meses."
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={demoData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <defs>
              <filter id="glow-blue" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-red" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="1 8" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="transparent"
              tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              stroke="transparent"
              tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              axisLine={false}
              tickLine={false}
              width={42}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(8,10,16,0.96)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "10px",
                color: "#fff",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                fontSize: 12,
              }}
              formatter={(value: number) =>
                new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value)
              }
              labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: 4, fontSize: 11 }}
            />
            <Line
              type="monotone"
              dataKey="ingresos"
              stroke="#3D7FFF"
              strokeWidth={2}
              dot={<CustomDot />}
              activeDot={{ r: 5, fill: "#3D7FFF", stroke: "rgba(0,0,0,0.5)", strokeWidth: 2 }}
              name="Ingresos"
              filter="url(#glow-blue)"
            />
            <Line
              type="monotone"
              dataKey="gastos"
              stroke="#FF4444"
              strokeWidth={2}
              dot={<CustomDot />}
              activeDot={{ r: 5, fill: "#FF4444", stroke: "rgba(0,0,0,0.5)", strokeWidth: 2 }}
              name="Gastos"
              filter="url(#glow-red)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
