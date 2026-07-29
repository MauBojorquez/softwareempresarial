"use client";

import { useEffect, useState } from "react";
import { Landmark, Receipt, ArrowRight, Wallet } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { DashboardSkeleton } from "@/components/dashboard/skeleton";

type DashboardData = {
  cajaBalance: number;
  cajaDeposits: number;
  cajaWithdrawals: number;
  cobranza?: {
    total: number; porCobrar: number; cobrado: number;
    vencido: number; pagadas: number; pendientes: number;
  };
};

const fmtMoney = formatCurrency;

export default function OverviewPage() {
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/metrics/dashboard");
        if (res.ok) setData(await res.json());
        else toast("Error al cargar el dashboard", "error");
      } catch {
        toast("Error de conexión", "error");
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <DashboardSkeleton />;

  if (!data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">No se pudieron cargar los datos. Intenta recargar.</p>
        </div>
      </div>
    );
  }

  const cob = data.cobranza;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Resumen de administración y cobranza</p>
        </div>
        <a href="/dashboard/finance/cashflow" className="hidden sm:flex items-center gap-1.5 rounded-lg gradient-bg px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
          <Wallet className="h-4 w-4" /> Flujo de efectivo
        </a>
      </div>

      {/* Flujo de efectivo (bancos) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-[#3D7FFF]" />
          <h3 className="text-sm font-semibold text-foreground">Flujo de efectivo</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryTile label="Saldo en bancos" value={fmtMoney(data.cajaBalance)} tone="slate" />
          <SummaryTile label="Ingresos del mes" value={fmtMoney(data.cajaDeposits)} tone="emerald" />
          <SummaryTile label="Egresos del mes" value={fmtMoney(data.cajaWithdrawals)} tone="red" />
          <SummaryTile label="Flujo neto del mes" value={fmtMoney(data.cajaDeposits - data.cajaWithdrawals)} tone="slate" />
        </div>
      </div>

      {/* Cobranza */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Cobranza</h3>
          </div>
          <a href="/dashboard/finance/cobranza" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">Ver detalle <ArrowRight className="h-3 w-3" /></a>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryTile label="Por cobrar" value={fmtMoney(cob?.porCobrar ?? 0)} sub={`${cob?.pendientes ?? 0} facturas`} tone="amber" />
          <SummaryTile label="Cobrado" value={fmtMoney(cob?.cobrado ?? 0)} sub={`${cob?.pagadas ?? 0} pagadas`} tone="emerald" />
          <SummaryTile label="Vencido (+30 días)" value={fmtMoney(cob?.vencido ?? 0)} tone="red" />
          <SummaryTile label="Total facturas" value={String(cob?.total ?? 0)} tone="slate" />
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "amber" | "emerald" | "red" | "slate" }) {
  const accent: Record<string, string> = {
    amber: "text-amber-600 dark:text-amber-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    red: "text-red-600 dark:text-red-400",
    slate: "text-foreground",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-bold tracking-tight", accent[tone])}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
