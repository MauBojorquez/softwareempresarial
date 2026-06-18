"use client";

import { useEffect, useState } from "react";
import { Megaphone, MousePointerClick, DollarSign, Eye, Target, BarChart3, Loader2, LinkIcon } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";

export default function MarketingPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/metrics/marketing")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.connected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
          <p className="text-sm text-muted-foreground">Rendimiento de campañas y adquisición</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-card py-20">
          <LinkIcon className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Conecta Meta Ads</h3>
          <p className="mt-1 text-sm text-muted-foreground text-center max-w-md">
            Para ver tus métricas de marketing, conecta tu cuenta de Meta Ads desde la página de integraciones.
          </p>
          <a
            href="/dashboard/integrations"
            className="mt-4 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Ir a Integraciones
          </a>
        </div>
      </div>
    );
  }

  const { current, changes } = data;
  const n = (v: any) => (typeof v === "number" ? v : Number(v) || 0);
  const fmt = (v: any) => new Intl.NumberFormat("es-MX").format(Math.round(n(v)));
  const fmtMoney = (v: any) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n(v));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
        <p className="text-sm text-muted-foreground">Métricas de Meta Ads en tiempo real</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Gasto Total"
          value={fmtMoney(current.spend)}
          change={changes.spend}
          icon={DollarSign}
        />
        <MetricCard
          title="Clics"
          value={fmt(current.clicks)}
          change={changes.clicks}
          icon={MousePointerClick}
        />
        <MetricCard
          title="CTR"
          value={`${n(current.ctr).toFixed(2)}%`}
          change={changes.ctr}
          icon={Target}
        />
        <MetricCard
          title="ROAS"
          value={`${n(current.roas).toFixed(2)}x`}
          change={changes.roas}
          icon={Megaphone}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-card p-6">
          <h3 className="text-lg font-semibold">Métricas de Alcance</h3>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-3">
                <Eye className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium">Impresiones</span>
              </div>
              <span className="text-sm font-semibold">{fmt(current.impressions)}</span>
            </div>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-3">
                <Megaphone className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium">Alcance</span>
              </div>
              <span className="text-sm font-semibold">{fmt(current.reach)}</span>
            </div>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-3">
                <MousePointerClick className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-medium">Clics</span>
              </div>
              <span className="text-sm font-semibold">{fmt(current.clicks)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Target className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-medium">Conversiones</span>
              </div>
              <span className="text-sm font-semibold">{fmt(current.conversions)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-card p-6">
          <h3 className="text-lg font-semibold">Costos por Resultado</h3>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-3">
                <DollarSign className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium">Costo por Clic (CPC)</span>
              </div>
              <span className="text-sm font-semibold">{fmtMoney(current.cpc)}</span>
            </div>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium">CPM</span>
              </div>
              <span className="text-sm font-semibold">{fmtMoney(current.cpm)}</span>
            </div>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-3">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-medium">Gasto Total</span>
              </div>
              <span className="text-sm font-semibold">{fmtMoney(current.spend)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Megaphone className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-medium">ROAS</span>
              </div>
              <span className="text-sm font-semibold">{n(current.roas).toFixed(2)}x</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
