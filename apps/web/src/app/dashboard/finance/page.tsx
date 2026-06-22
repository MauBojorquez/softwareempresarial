"use client";

import { useState, useEffect } from "react";
import { DollarSign, TrendingDown, Wallet, PiggyBank, ArrowRight, TrendingUp, Landmark } from "lucide-react";
import { MetricsDashboard } from "@/components/dashboard/metrics-page";
import { CATEGORY_TEMPLATES } from "@/lib/metric-templates";
import Link from "next/link";

type MetricEntry = { id: string; name: string; value: number; unit: string | null; period: string };

const TEMPLATES = CATEGORY_TEMPLATES.FINANCE;

const ICON_MAP: Record<string, typeof DollarSign> = {
  Ingresos: DollarSign,
  Gastos: TrendingDown,
  "Flujo de Caja": Wallet,
  "Cuentas por Cobrar": PiggyBank,
  "Cuentas por Pagar": PiggyBank,
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

type CashFlowSummary = {
  grandBalance: number;
  grandTotalDeposits: number;
  grandTotalWithdrawals: number;
  accounts: { name: string; currentBalance: number }[];
};

function CashFlowBanner() {
  const [data, setData] = useState<CashFlowSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cashflow/report")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && Array.isArray(d.accounts)) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !data || !data.accounts?.length) return null;

  const balance = data.grandBalance;
  const deposits = data.grandTotalDeposits;
  const withdrawals = data.grandTotalWithdrawals;

  return (
    <div className="relative rounded-2xl border border-border bg-card overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-primary" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Flujo de Efectivo — Saldo en Bancos</p>
        </div>
        <Link href="/dashboard/finance/cashflow" className="flex items-center gap-1 text-[10px] text-primary hover:opacity-80">
          Ver detalle <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-3 px-4 pb-4">
        <div className="relative overflow-hidden rounded-xl border border-border bg-secondary/30 p-3">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Saldo Disponible</p>
          <p className="mt-1 text-lg font-extrabold tabular-nums" style={{ color: balance >= 0 ? "#00E87B" : "#FF4444" }}>{fmt(balance)}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">{data.accounts.length} cuenta{data.accounts.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-border bg-secondary/30 p-3">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Total Depósitos</p>
          <p className="mt-1 text-lg font-extrabold tabular-nums text-emerald-400">{fmt(deposits)}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <TrendingUp className="h-3 w-3 text-emerald-400" />
            <p className="text-[9px] text-emerald-400/70">Acumulado</p>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-border bg-secondary/30 p-3">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Total Retiros</p>
          <p className="mt-1 text-lg font-extrabold tabular-nums text-red-400">{fmt(withdrawals)}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <TrendingDown className="h-3 w-3 text-red-400" />
            <p className="text-[9px] text-red-400/70">Acumulado</p>
          </div>
        </div>
      </div>
      {data.accounts.length > 0 && (
        <div className="border-t border-border/50 px-4 py-2 flex gap-4 overflow-x-auto">
          {data.accounts.map(a => (
            <div key={a.name} className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-muted-foreground">{a.name}</span>
              <span className="text-[10px] font-bold tabular-nums" style={{ color: a.currentBalance >= 0 ? "#00E87B" : "#FF4444" }}>
                {fmt(a.currentBalance)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FinanceChart({ metrics, months }: { metrics: MetricEntry[]; months: number }) {
  const now = new Date();
  const monthSlots = Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - i), 1));
    return {
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("es-MX", { month: "short", year: months > 6 ? "2-digit" : undefined, timeZone: "UTC" }),
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
    <div className="rounded-2xl border border-border bg-card p-4">
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
          role="img"
          aria-label="Gráfica de barras de ingresos contra gastos por mes."
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
      extraContent={(metrics, months) => (
        <>
          <CashFlowBanner />
          <FinanceChart metrics={metrics} months={months} />
          <Link
            href="/dashboard/finance/cashflow"
            className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 hover:bg-white/[0.02] transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#3D7FFF]/10 flex items-center justify-center">
                <Wallet size={20} className="text-[#3D7FFF]" />
              </div>
              <div>
                <p className="font-semibold text-sm">Flujo de Efectivo</p>
                <p className="text-xs text-muted-foreground">Gestiona cuentas bancarias y movimientos con ledger interactivo</p>
              </div>
            </div>
            <ArrowRight size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
        </>
      )}
    />
  );
}
