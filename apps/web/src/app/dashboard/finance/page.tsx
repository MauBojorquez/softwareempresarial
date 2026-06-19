"use client";

import { DollarSign, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { MetricsDashboard } from "@/components/dashboard/metrics-page";

type MetricEntry = { id: string; name: string; value: number; unit: string | null; period: string };

const TEMPLATES = [
  { name: "Ingresos", unit: "MXN" },
  { name: "Gastos", unit: "MXN" },
  { name: "Cuentas por Cobrar", unit: "MXN" },
  { name: "Cuentas por Pagar", unit: "MXN" },
  { name: "Flujo de Caja", unit: "MXN" },
];

const ICON_MAP: Record<string, typeof DollarSign> = {
  Ingresos: DollarSign,
  Gastos: TrendingDown,
  "Flujo de Caja": Wallet,
  "Cuentas por Cobrar": PiggyBank,
  "Cuentas por Pagar": PiggyBank,
};

function FinanceChart({ metrics, months }: { metrics: MetricEntry[]; months: number }) {
  const now = new Date();
  const monthSlots = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("es-MX", { month: "short", year: months > 6 ? "2-digit" : undefined }),
    };
  });
  const sum = (name: string, key: string) =>
    metrics.filter((m) => m.name === name && m.period.startsWith(key)).reduce((s, m) => s + m.value, 0);
  const ingData = monthSlots.map((s) => sum("Ingresos", s.key));
  const gasData = monthSlots.map((s) => sum("Gastos", s.key));
  const maxVal = Math.max(...ingData, ...gasData, 1);
  const BAR_H = 80;
  const barW = Math.max(8, Math.floor(260 / monthSlots.length) - 4);
  const gap = Math.max(2, Math.floor(260 / monthSlots.length) * 0.2);
  const totalW = monthSlots.length * (barW * 2 + gap + 4);
  const hasChart = ingData.some((v) => v > 0) || gasData.some((v) => v > 0);
  if (!hasChart) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">Tendencia Mensual</h3>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" />Ingresos</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-red-400" />Gastos</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${Math.max(totalW, 300)} ${BAR_H + 24}`}
          className="w-full"
          style={{ minWidth: `${Math.max(totalW, 300)}px`, maxWidth: "100%", height: `${BAR_H + 30}px` }}
        >
          {monthSlots.map((slot, i) => {
            const x = i * (barW * 2 + gap + 4);
            const ingH = (ingData[i] / maxVal) * BAR_H;
            const gasH = (gasData[i] / maxVal) * BAR_H;
            return (
              <g key={slot.key}>
                {ingData[i] > 0 && <rect x={x} y={BAR_H - ingH} width={barW} height={ingH} rx="3" fill="rgb(16 185 129 / 0.7)" />}
                {gasData[i] > 0 && <rect x={x + barW + gap} y={BAR_H - gasH} width={barW} height={gasH} rx="3" fill="rgb(248 113 113 / 0.7)" />}
                <text x={x + barW} y={BAR_H + 14} textAnchor="middle" fontSize="9" fill="currentColor" className="text-muted-foreground" style={{ opacity: 0.6 }}>{slot.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function FinancePage() {
  return (
    <MetricsDashboard
      title="Finanzas"
      subtitle="Métricas financieras"
      category="FINANCE"
      templates={TEMPLATES}
      defaultSelected={["Ingresos", "Gastos", "Cuentas por Cobrar", "Flujo de Caja"]}
      iconMap={ICON_MAP}
      defaultIcon={DollarSign}
      activityLabel="Finanzas"
      emptyTitle="Sin datos financieros"
      emptySubtitle="Conecta el SAT para importar automáticamente o agrega manualmente tus ingresos, gastos y flujo de caja."
      extraContent={(metrics, months) => <FinanceChart metrics={metrics} months={months} />}
    />
  );
}
