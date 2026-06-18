"use client";

import { useEffect, useState } from "react";
import { Megaphone, MousePointerClick, DollarSign, Eye, Target, BarChart3, Loader2, LinkIcon, TrendingUp, Calendar } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { cn } from "@/lib/utils";

export default function MarketingPage() {
  const [data, setData] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "campaigns" | "history">("overview");

  useEffect(() => {
    Promise.all([
      fetch("/api/metrics/marketing").then((r) => r.json()),
      fetch("/api/metrics/marketing/campaigns?months=6").then((r) => r.json()),
    ])
      .then(([d, c]) => {
        setData(d);
        setCampaigns(c);
        setLoading(false);
      })
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20">
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

  const campaignList = campaigns?.campaigns || [];
  const monthlyData = campaigns?.monthly || [];
  const maxSpend = Math.max(...monthlyData.map((m: any) => n(m.spend)), 1);

  const statusColor = (s: string) => {
    if (s === "ACTIVE") return "text-emerald-600 bg-emerald-50";
    if (s === "PAUSED") return "text-amber-600 bg-amber-50";
    return "text-muted-foreground bg-secondary/50";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
          <p className="text-sm text-muted-foreground">Métricas de Meta Ads en tiempo real</p>
        </div>
        {campaigns && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Megaphone className="h-4 w-4" />
            <span>{campaigns.activeCampaigns || 0} activas de {campaigns.totalCampaigns || 0}</span>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Gasto Total" value={fmtMoney(current.spend)} change={changes.spend ?? undefined} icon={DollarSign} />
        <MetricCard title="Clics" value={fmt(current.clicks)} change={changes.clicks ?? undefined} icon={MousePointerClick} />
        <MetricCard title="CTR" value={`${n(current.ctr).toFixed(2)}%`} change={changes.ctr ?? undefined} icon={Target} />
        <MetricCard title="ROAS" value={`${n(current.roas).toFixed(2)}x`} change={changes.roas ?? undefined} icon={Megaphone} />
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/50 p-1 w-fit">
        {(["overview", "campaigns", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "overview" ? "Resumen" : t === "campaigns" ? "Campañas" : "Historial"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-lg font-semibold">Métricas de Alcance</h3>
            <div className="mt-4 space-y-4">
              {[
                { icon: Eye, color: "text-blue-600", label: "Impresiones", value: fmt(current.impressions) },
                { icon: Megaphone, color: "text-purple-600", label: "Alcance", value: fmt(current.reach) },
                { icon: MousePointerClick, color: "text-emerald-600", label: "Clics", value: fmt(current.clicks) },
                { icon: Target, color: "text-amber-600", label: "Conversiones", value: fmt(current.conversions) },
              ].map((item, i, arr) => (
                <div key={item.label} className={cn("flex items-center justify-between", i < arr.length - 1 && "border-b border-border pb-3")}>
                  <div className="flex items-center gap-3">
                    <item.icon className={cn("h-4 w-4", item.color)} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-lg font-semibold">Costos por Resultado</h3>
            <div className="mt-4 space-y-4">
              {[
                { icon: DollarSign, color: "text-blue-600", label: "Costo por Clic (CPC)", value: fmtMoney(current.cpc) },
                { icon: BarChart3, color: "text-purple-600", label: "CPM", value: fmtMoney(current.cpm) },
                { icon: DollarSign, color: "text-emerald-600", label: "Gasto Total", value: fmtMoney(current.spend) },
                { icon: Megaphone, color: "text-amber-600", label: "ROAS", value: `${n(current.roas).toFixed(2)}x` },
              ].map((item, i, arr) => (
                <div key={item.label} className={cn("flex items-center justify-between", i < arr.length - 1 && "border-b border-border pb-3")}>
                  <div className="flex items-center gap-3">
                    <item.icon className={cn("h-4 w-4", item.color)} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "campaigns" && (
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <h3 className="font-semibold">Campañas ({campaignList.length})</h3>
          </div>
          {campaignList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Megaphone className="h-8 w-8 mb-2" />
              <p className="text-sm">No se encontraron campañas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="p-3 font-medium">Campaña</th>
                    <th className="p-3 font-medium">Estado</th>
                    <th className="p-3 font-medium text-right">Gasto</th>
                    <th className="p-3 font-medium text-right">Impresiones</th>
                    <th className="p-3 font-medium text-right">Clics</th>
                    <th className="p-3 font-medium text-right">CTR</th>
                    <th className="p-3 font-medium text-right">CPC</th>
                    <th className="p-3 font-medium text-right">Conv.</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignList.map((c: any) => (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="p-3">
                        <p className="font-medium truncate max-w-[200px]">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.objective?.replace(/_/g, " ") || "—"}</p>
                      </td>
                      <td className="p-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", statusColor(c.status))}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-3 text-right font-medium">{fmtMoney(c.spend)}</td>
                      <td className="p-3 text-right">{fmt(c.impressions)}</td>
                      <td className="p-3 text-right">{fmt(c.clicks)}</td>
                      <td className="p-3 text-right">{n(c.ctr).toFixed(2)}%</td>
                      <td className="p-3 text-right">{fmtMoney(c.cpc)}</td>
                      <td className="p-3 text-right">{fmt(c.conversions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-6">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Gasto Mensual (últimos 6 meses)</h3>
            </div>
            {monthlyData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos históricos</p>
            ) : (
              <div className="space-y-3">
                {monthlyData.map((m: any) => (
                  <div key={m.month} className="flex items-center gap-4">
                    <span className="w-24 text-sm text-muted-foreground shrink-0">{m.month}</span>
                    <div className="flex-1 h-8 bg-secondary/50 rounded-lg overflow-hidden">
                      <div
                        className="h-full gradient-bg rounded-lg transition-all"
                        style={{ width: `${Math.max((n(m.spend) / maxSpend) * 100, 2)}%` }}
                      />
                    </div>
                    <span className="w-28 text-sm font-semibold text-right shrink-0">{fmtMoney(m.spend)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Detalle Mensual</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="p-3 font-medium">Mes</th>
                    <th className="p-3 font-medium text-right">Gasto</th>
                    <th className="p-3 font-medium text-right">Impresiones</th>
                    <th className="p-3 font-medium text-right">Clics</th>
                    <th className="p-3 font-medium text-right">CTR</th>
                    <th className="p-3 font-medium text-right">CPC</th>
                    <th className="p-3 font-medium text-right">Alcance</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((m: any) => (
                    <tr key={m.month} className="border-b border-border last:border-0">
                      <td className="p-3 font-medium">{m.month}</td>
                      <td className="p-3 text-right font-medium">{fmtMoney(m.spend)}</td>
                      <td className="p-3 text-right">{fmt(m.impressions)}</td>
                      <td className="p-3 text-right">{fmt(m.clicks)}</td>
                      <td className="p-3 text-right">{n(m.ctr).toFixed(2)}%</td>
                      <td className="p-3 text-right">{fmtMoney(m.cpc)}</td>
                      <td className="p-3 text-right">{fmt(m.reach)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
