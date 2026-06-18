"use client";

import { useEffect, useState } from "react";
import { Megaphone, MousePointerClick, DollarSign, Eye, Target, BarChart3, Loader2, LinkIcon, TrendingUp, Calendar, Download, X, AlertTriangle, RefreshCw } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { cn } from "@/lib/utils";

export default function MarketingPage() {
  const [data, setData] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "campaigns" | "history">("overview");

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch("/api/metrics/marketing").then((r) => r.json()),
      fetch("/api/metrics/marketing/campaigns?months=6").then((r) => r.json()),
    ])
      .then(([d, c]) => {
        setData(d);
        setCampaigns(c);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (error) return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-card py-16">
      <div className="rounded-full bg-destructive/10 p-3 mb-4"><X className="h-6 w-6 text-destructive" /></div>
      <h3 className="text-lg font-semibold">Error al cargar datos</h3>
      <p className="mt-1 text-sm text-muted-foreground">{error}</p>
      <button onClick={load} className="mt-4 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90">Reintentar</button>
    </div>
  );

  const metaConnected = data?.connected || campaigns?.connected;
  const tokenExpired = campaigns?.tokenExpired;

  if (!metaConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Marketing</h1>
          <p className="text-sm text-muted-foreground">Rendimiento de campañas y adquisición</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 sm:py-20">
          <LinkIcon className="h-8 w-8 text-muted-foreground mb-3 sm:h-10 sm:w-10 sm:mb-4" />
          <h3 className="text-base font-semibold sm:text-lg">Conecta Meta Ads</h3>
          <p className="mt-1 text-sm text-muted-foreground text-center max-w-md px-4">
            Para ver tus métricas de marketing, conecta tu cuenta de Meta Ads desde integraciones.
          </p>
          <a href="/dashboard/integrations" className="mt-4 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90">
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
  const fetchError = campaigns?.error;

  const statusLabel = (s: string) => {
    if (s === "ACTIVE") return { text: "Activa", cls: "text-emerald-600 bg-emerald-50" };
    if (s === "PAUSED") return { text: "Pausada", cls: "text-amber-600 bg-amber-50" };
    return { text: s, cls: "text-muted-foreground bg-secondary/50" };
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Marketing</h1>
          <p className="text-sm text-muted-foreground">Datos en tiempo real de Meta Ads</p>
        </div>
        {campaigns && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
            <Megaphone className="h-4 w-4" />
            <span>{campaigns.activeCampaigns || 0} activas de {campaigns.totalCampaigns || 0}</span>
          </div>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Gasto" value={fmtMoney(current.spend)} change={changes.spend ?? undefined} icon={DollarSign} />
        <MetricCard title="Clics" value={fmt(current.clicks)} change={changes.clicks ?? undefined} icon={MousePointerClick} />
        <MetricCard title="CTR" value={`${n(current.ctr).toFixed(2)}%`} change={changes.ctr ?? undefined} icon={Target} />
        <MetricCard title="Alcance" value={fmt(current.reach)} icon={Eye} />
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/50 p-1 w-fit overflow-x-auto">
        {(["overview", "campaigns", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap sm:px-4 sm:text-sm",
              tab === t ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "overview" ? "Resumen" : t === "campaigns" ? "Campañas" : "Historial"}
          </button>
        ))}
      </div>

      {tokenExpired && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Token de Meta Ads expirado</p>
              <p className="text-xs text-muted-foreground mt-1">
                {campaigns?.error || "Tu token de acceso expiró. Reconecta tu cuenta para ver datos actualizados."}
              </p>
              <a href="/dashboard/integrations" className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">
                <RefreshCw className="h-3 w-3" />
                Reconectar
              </a>
            </div>
          </div>
        </div>
      )}

      {fetchError && !tokenExpired && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          {fetchError}
        </div>
      )}

      {campaigns?.accountName && (
        <p className="text-xs text-muted-foreground">
          Cuenta: <span className="font-medium text-foreground">{campaigns.accountName}</span>
        </p>
      )}

      {tab === "overview" && (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold sm:text-base">Métricas de Alcance</h3>
            <div className="mt-3 space-y-3 sm:mt-4">
              {[
                { icon: Eye, color: "text-blue-600", label: "Impresiones", value: fmt(current.impressions) },
                { icon: Megaphone, color: "text-purple-600", label: "Alcance", value: fmt(current.reach) },
                { icon: MousePointerClick, color: "text-emerald-600", label: "Clics", value: fmt(current.clicks) },
                { icon: Target, color: "text-amber-600", label: "Conversiones", value: fmt(current.conversions) },
              ].map((item, i, arr) => (
                <div key={item.label} className={cn("flex items-center justify-between", i < arr.length - 1 && "border-b border-border pb-3")}>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <item.icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", item.color)} />
                    <span className="text-xs font-medium sm:text-sm">{item.label}</span>
                  </div>
                  <span className="text-xs font-semibold sm:text-sm">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold sm:text-base">Costos</h3>
            <div className="mt-3 space-y-3 sm:mt-4">
              {[
                { icon: DollarSign, color: "text-blue-600", label: "CPC", value: fmtMoney(current.cpc) },
                { icon: BarChart3, color: "text-purple-600", label: "CPM", value: fmtMoney(current.cpm) },
                { icon: DollarSign, color: "text-emerald-600", label: "Gasto Total", value: fmtMoney(current.spend) },
              ].map((item, i, arr) => (
                <div key={item.label} className={cn("flex items-center justify-between", i < arr.length - 1 && "border-b border-border pb-3")}>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <item.icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", item.color)} />
                    <span className="text-xs font-medium sm:text-sm">{item.label}</span>
                  </div>
                  <span className="text-xs font-semibold sm:text-sm">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "campaigns" && (
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border p-3 sm:p-4">
            <h3 className="text-sm font-semibold sm:text-base">Campañas ({campaignList.length})</h3>
          </div>
          {campaignList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground sm:py-16">
              <Megaphone className="h-8 w-8 mb-2" />
              <p className="text-sm">No se encontraron campañas</p>
            </div>
          ) : (
            <>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th scope="col" className="p-3 font-medium">Campaña</th>
                      <th scope="col" className="p-3 font-medium">Estado</th>
                      <th scope="col" className="p-3 font-medium text-right">Gasto</th>
                      <th scope="col" className="p-3 font-medium text-right">Clics</th>
                      <th scope="col" className="p-3 font-medium text-right">CTR</th>
                      <th scope="col" className="p-3 font-medium text-right">CPC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignList.map((c: any) => {
                      const st = statusLabel(c.status);
                      return (
                        <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                          <td className="p-3">
                            <p className="font-medium truncate max-w-[200px]">{c.name}</p>
                          </td>
                          <td className="p-3">
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", st.cls)}>{st.text}</span>
                          </td>
                          <td className="p-3 text-right font-medium">{fmtMoney(c.spend)}</td>
                          <td className="p-3 text-right">{fmt(c.clicks)}</td>
                          <td className="p-3 text-right">{n(c.ctr).toFixed(2)}%</td>
                          <td className="p-3 text-right">{fmtMoney(c.cpc)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="sm:hidden divide-y divide-border">
                {campaignList.map((c: any) => {
                  const st = statusLabel(c.status);
                  return (
                    <div key={c.id} className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate flex-1 mr-2">{c.name}</p>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0", st.cls)}>{st.text}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div><span className="block font-medium text-foreground">{fmtMoney(c.spend)}</span>Gasto</div>
                        <div><span className="block font-medium text-foreground">{fmt(c.clicks)}</span>Clics</div>
                        <div><span className="block font-medium text-foreground">{n(c.ctr).toFixed(2)}%</span>CTR</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-4 sm:space-y-6">
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4 sm:mb-6">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold sm:text-base">Gasto Mensual (6 meses)</h3>
            </div>
            {monthlyData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos históricos</p>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {monthlyData.map((m: any) => (
                  <div key={m.month} className="flex items-center gap-2 sm:gap-4">
                    <span className="w-16 text-xs text-muted-foreground shrink-0 sm:w-24 sm:text-sm">{m.month}</span>
                    <div className="flex-1 h-6 bg-secondary/50 rounded-lg overflow-hidden sm:h-8">
                      {m.hasData === false && n(m.spend) === 0 ? (
                        <div className="h-full flex items-center px-2">
                          <span className="text-[10px] text-muted-foreground">Sin datos</span>
                        </div>
                      ) : (
                        <div className="h-full gradient-bg rounded-lg" style={{ width: `${Math.max((n(m.spend) / maxSpend) * 100, 2)}%` }} />
                      )}
                    </div>
                    <span className={cn("w-20 text-xs font-semibold text-right shrink-0 sm:w-28 sm:text-sm", m.hasData === false && "text-muted-foreground")}>{fmtMoney(m.spend)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold sm:text-base">Detalle Mensual</h3>
              </div>
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th scope="col" className="p-3 font-medium">Mes</th>
                    <th scope="col" className="p-3 font-medium text-right">Gasto</th>
                    <th scope="col" className="p-3 font-medium text-right">Impresiones</th>
                    <th scope="col" className="p-3 font-medium text-right">Clics</th>
                    <th scope="col" className="p-3 font-medium text-right">CTR</th>
                    <th scope="col" className="p-3 font-medium text-right">CPC</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sm:hidden divide-y divide-border">
              {monthlyData.map((m: any) => (
                <div key={m.month} className="p-3">
                  <p className="text-sm font-medium mb-1">{m.month}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div><span className="block font-medium text-foreground">{fmtMoney(m.spend)}</span>Gasto</div>
                    <div><span className="block font-medium text-foreground">{fmt(m.clicks)}</span>Clics</div>
                    <div><span className="block font-medium text-foreground">{n(m.ctr).toFixed(2)}%</span>CTR</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
