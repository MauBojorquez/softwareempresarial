"use client";

import { useState, useEffect, useCallback } from "react";
import { DollarSign, TrendingDown, Wallet, PiggyBank, ArrowRight, TrendingUp, Landmark } from "lucide-react";
import { MetricsDashboard } from "@/components/dashboard/metrics-page";
import { CATEGORY_TEMPLATES } from "@/lib/metric-templates";
import Link from "next/link";
import { Card } from "@/components/ui/page-header";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";

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
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/cashflow/report")
      .then(async (r) => {
        // Sin permiso para Flujo de Efectivo: el banner simplemente no se muestra.
        if (r.status === 401 || r.status === 403) return null;
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || "No se pudo cargar el flujo de efectivo");
        }
        return r.json();
      })
      .then((d) => { setData(d && Array.isArray(d.accounts) ? d : null); })
      .catch((e: Error) => setError(e.message || "No se pudo cargar el flujo de efectivo"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <Card className="p-4" aria-busy="true" aria-label="Cargando flujo de efectivo">
        <Skeleton className="h-4 w-56" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <ErrorState message={error} onRetry={load} className="py-8" />
      </Card>
    );
  }

  if (!data || !data.accounts?.length) return null;

  const balance = data.grandBalance;
  const deposits = data.grandTotalDeposits;
  const withdrawals = data.grandTotalWithdrawals;

  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Flujo de Efectivo — Saldo en Bancos</h2>
        </div>
        <Link href="/dashboard/finance/cashflow" className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">
          Ver detalle <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-secondary/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">Saldo Disponible</p>
          <p className={cn("mt-1 text-lg font-extrabold tabular-nums", balance >= 0 ? "text-success" : "text-destructive")}>{fmt(balance)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{data.accounts.length} cuenta{data.accounts.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-xl border border-border bg-secondary/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">Total Depósitos</p>
          <p className="mt-1 text-lg font-extrabold tabular-nums text-success">{fmt(deposits)}</p>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-success" />
            Acumulado
          </div>
        </div>
        <div className="rounded-xl border border-border bg-secondary/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">Total Retiros</p>
          <p className="mt-1 text-lg font-extrabold tabular-nums text-destructive">{fmt(withdrawals)}</p>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5 text-destructive" />
            Acumulado
          </div>
        </div>
      </div>
      {data.accounts.length > 0 && (
        <div className="flex gap-4 overflow-x-auto border-t border-border px-4 py-2">
          {data.accounts.map((a) => (
            <div key={a.name} className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-muted-foreground">{a.name}</span>
              <span className={cn("text-xs font-bold tabular-nums", a.currentBalance >= 0 ? "text-success" : "text-destructive")}>
                {fmt(a.currentBalance)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
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
    <Card className="p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Tendencia Mensual</h2>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-success/70" />Ingresos</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-destructive/70" />Gastos</span>
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
                {ingData[i] > 0 && <rect x={x} y={BAR_H - ingH} width={barW} height={ingH} rx="3" fill="currentColor" className="text-success" fillOpacity={0.7} />}
                {gasData[i] > 0 && <rect x={x + barW + gap} y={BAR_H - gasH} width={barW} height={gasH} rx="3" fill="currentColor" className="text-destructive" fillOpacity={0.7} />}
                <text x={x + barW} y={BAR_H + 14} textAnchor="middle" fontSize="12" fill="currentColor" className="text-muted-foreground">{slot.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </Card>
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
      disableManualEntry
      readOnlyNote="Finanzas se alimenta automáticamente del SAT y del módulo de Flujo de Efectivo. No se capturan datos manuales aquí: registra los movimientos en Flujo de Efectivo y se reflejarán en estas métricas."
      emptyTitle="Sin datos financieros"
      emptySubtitle="Conecta el SAT o registra movimientos en el módulo de Flujo de Efectivo para ver tus ingresos, gastos y flujo de caja."
      extraContent={(metrics, months) => (
        <>
          <CashFlowBanner />
          <FinanceChart metrics={metrics} months={months} />
          <Link
            href="/dashboard/finance/cashflow"
            className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary/60"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Wallet size={20} className="text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Flujo de Efectivo</p>
                <p className="text-xs text-muted-foreground">Gestiona cuentas bancarias y movimientos con ledger interactivo</p>
              </div>
            </div>
            <ArrowRight size={16} className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
          </Link>
        </>
      )}
    />
  );
}
