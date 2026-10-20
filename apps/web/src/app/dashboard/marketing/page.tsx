"use client";

import { useEffect, useState } from "react";
import { Megaphone, MousePointerClick, DollarSign, Eye, Target, BarChart3, LinkIcon, TrendingUp, Calendar, AlertTriangle, RefreshCw, History } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { PageHeader, Card } from "@/components/ui/page-header";
import { EmptyState, ErrorState, CardsSkeleton, RowsSkeleton, Skeleton } from "@/components/ui/states";

export default function MarketingPage() {
  const [campaigns, setCampaigns] = useState<any>(null);
  const [acq, setAcq] = useState<any>(null);
  const [acqError, setAcqError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "campaigns" | "history">("overview");
  const [selectedAccount, setSelectedAccount] = useState<string>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("mkt_account") ?? "";
    return "";
  });

  const load = (accountId?: string) => {
    setLoading(true);
    setError(null);
    const acct = accountId ?? selectedAccount;
    const acctParam = acct ? `&accountId=${acct}` : "";
    // Campaigns are the single source of truth. The overview is computed from them.
    fetch(`/api/metrics/marketing/campaigns?months=6${acctParam}`)
      .then((r) => { if (!r.ok) throw new Error("Error al cargar campañas"); return r.json(); })
      .then((c) => {
        setCampaigns(c);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  // Automatic "Adquisición" block: our own META leads + conversion, fed by the
  // shared Resumen marketing computation (Meta metrics + Lead/Venta tables).
  const loadAcq = () => {
    setAcqError(null);
    fetch("/api/resumen?blocks=marketing")
      .then(async (r) => {
        // Sin permiso para el bloque: simplemente no se muestra.
        if (r.status === 401 || r.status === 403) return null;
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || "No se pudo cargar la adquisición");
        }
        return r.json();
      })
      .then((j) => setAcq(j?.blocks?.marketing ?? null))
      .catch((e: Error) => setAcqError(e.message || "No se pudo cargar la adquisición"));
  };

  useEffect(() => { loadAcq(); }, []);

  const refreshButton = (
    <Button variant="outline" size="sm" onClick={() => load()} loading={loading} aria-label="Actualizar datos">
      {!loading && <RefreshCw />}
      <span className="hidden sm:inline">Actualizar</span>
    </Button>
  );

  if (loading && !campaigns) {
    return (
      <div className="space-y-5">
        <PageHeader icon={Megaphone} title="Marketing" description="Datos en tiempo real de Meta Ads" actions={refreshButton} />
        <CardsSkeleton count={4} className="grid-cols-2" />
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Card>
          <div className="border-b border-border p-4"><Skeleton className="h-5 w-40" /></div>
          <RowsSkeleton rows={4} />
        </Card>
      </div>
    );
  }

  if (error) return (
    <div className="space-y-5">
      <PageHeader icon={Megaphone} title="Marketing" description="Datos en tiempo real de Meta Ads" actions={refreshButton} />
      <Card>
        <ErrorState message={error} onRetry={() => load()} />
      </Card>
    </div>
  );

  const metaConnected = campaigns?.connected;
  const tokenExpired = campaigns?.tokenExpired;

  if (!metaConnected) {
    return (
      <div className="space-y-5">
        <PageHeader icon={Megaphone} title="Marketing" description="Rendimiento de campañas y adquisición" />
        <Card>
          <EmptyState
            icon={LinkIcon}
            title="Conecta Meta Ads"
            description="Para ver tus métricas de marketing, conecta la cuenta de Meta Ads de la empresa."
            action={
              <Button asChild>
                <a href="/api/integrations/meta">Conectar Meta Ads</a>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const n = (v: any) => (typeof v === "number" ? v : Number(v) || 0);
  const fmt = (v: any) => new Intl.NumberFormat("es-MX").format(Math.round(n(v)));
  const fmtMoney = (v: any) => formatCurrency(n(v));

  const campaignList = campaigns?.campaigns || [];
  const monthlyData = campaigns?.monthly || [];
  const maxSpend = Math.max(...monthlyData.map((m: any) => n(m.spend)), 1);
  const fetchError = campaigns?.error;
  // Overview is the sum of the campaigns shown below (single source of truth).
  const current = campaigns?.summary || { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 };
  const changes = campaigns?.changes || {};
  const totalResults = n(current.results);

  const statusLabel = (s: string) => {
    if (s === "ACTIVE") return { text: "Activa", cls: "text-success bg-success/10" };
    if (s === "PAUSED") return { text: "Pausada", cls: "text-warning bg-warning/10" };
    if (s === "DELETED" || s === "ARCHIVED") return { text: "Archivada", cls: "text-muted-foreground bg-secondary" };
    if (s === "WITH_ISSUES") return { text: "Con problemas", cls: "text-destructive bg-destructive/10" };
    if (s === "INACTIVE") return { text: "Inactiva", cls: "text-muted-foreground bg-secondary" };
    if (s === "COMPLETED") return { text: "Completada", cls: "text-info bg-info/10" };
    if (s === "IN_PROCESS") return { text: "En proceso", cls: "text-primary bg-primary/10" };
    return { text: "—", cls: "text-muted-foreground bg-secondary" };
  };


  return (
    <div className="space-y-5">
      <PageHeader
        icon={Megaphone}
        title="Marketing"
        description="Datos en tiempo real de Meta Ads"
        actions={
          <>
            {campaigns && (
              <span className="text-xs text-muted-foreground sm:text-sm">
                {campaigns.activeCampaigns || 0} activas de {campaigns.totalCampaigns || 0}
              </span>
            )}
            {refreshButton}
          </>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Gasto" value={fmtMoney(current.spend)} change={changes.spend ?? undefined} icon={DollarSign} />
        <MetricCard title="Conversiones" value={fmt(current.results)} icon={Target} />
        <MetricCard title="Costo por Lead" value={fmtMoney(current.costPerResult ?? 0)} icon={BarChart3} />
        <MetricCard title="Clics" value={fmt(current.clicks)} change={changes.clicks ?? undefined} icon={MousePointerClick} />
      </div>

      {acqError && !acq && (
        <Card>
          <ErrorState message={acqError} onRetry={loadAcq} className="py-8" />
        </Card>
      )}

      {acq && (
        <Card className="p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold sm:text-base">Adquisición (leads Meta)</h2>
          </div>
          {acq.porCampana === undefined && acq.gasto === undefined ? (
            // Count-only view (COMERCIAL).
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-background/50 p-3">
                <p className="text-xs text-muted-foreground">Leads del mes</p>
                <p className="mt-1 text-lg font-bold">{fmt(acq.metaLeadsMes)}</p>
              </div>
              <div className="rounded-xl border border-border bg-background/50 p-3">
                <p className="text-xs text-muted-foreground">Leads de hoy</p>
                <p className="mt-1 text-lg font-bold">{fmt(acq.metaLeadsDia)}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: "Leads del mes", value: fmt(acq.metaLeadsMes), sub: `${fmt(acq.metaLeadsDia)} hoy` },
                  { label: "Costo por lead", value: acq.cpl != null ? fmtMoney(acq.cpl) : "—" },
                  { label: "Valor generado", value: fmtMoney(acq.valorPesos) },
                  { label: "Ganados", value: fmt(acq.conversion?.ganados ?? 0) },
                ].map((t) => (
                  <div key={t.label} className="rounded-xl border border-border bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground">{t.label}</p>
                    <p className="mt-1 text-lg font-bold">{t.value}</p>
                    {t.sub && <p className="mt-0.5 text-xs text-muted-foreground">{t.sub}</p>}
                  </div>
                ))}
              </div>
              {acq.porCampana?.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">Leads por campaña</p>
                  <div className="space-y-1.5">
                    {acq.porCampana.map((c: any) => (
                      <div key={c.campana} className="flex items-center justify-between text-sm">
                        <span className="truncate pr-2">{c.campana}</span>
                        <span className="font-semibold">{fmt(c.leads)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      <div role="tablist" aria-label="Vistas de marketing" className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-border bg-secondary p-1">
        {(["overview", "campaigns", "history"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:text-sm",
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "overview" ? "Resumen" : t === "campaigns" ? "Campañas" : "Historial"}
          </button>
        ))}
      </div>

      {tokenExpired && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Token de Meta Ads expirado</p>
              <p className="text-xs text-muted-foreground mt-1">
                {campaigns?.error || "Tu token de acceso expiró. Reconecta tu cuenta para ver datos actualizados."}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive">
                <a href="/api/integrations/meta">
                  <RefreshCw />
                  Reconectar
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}

      {fetchError && !tokenExpired && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>{fetchError}</span>
        </div>
      )}

      {campaigns?.adAccounts?.length > 0 && (
        campaigns.adAccounts.length === 1 ? (
          <p className="text-sm text-muted-foreground">
            Cuenta: <span className="font-medium text-foreground">{campaigns.adAccounts[0].name}</span>
          </p>
        ) : (
          <Field label="Cuenta publicitaria" className="max-w-xs">
            <Select
              value={selectedAccount || campaigns.adAccounts[0]?.id || ""}
              onChange={(e) => {
                setSelectedAccount(e.target.value);
                try { localStorage.setItem("mkt_account", e.target.value); } catch { /* sin almacenamiento: solo se pierde la preferencia */ }
                load(e.target.value);
              }}
            >
              {campaigns.adAccounts.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </Field>
        )
      )}

      {tab === "overview" && (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="text-sm font-semibold sm:text-base">Métricas de Alcance</h2>
            <div className="mt-3 space-y-3 sm:mt-4">
              {[
                { icon: Eye, color: "text-info", label: "Impresiones", value: fmt(current.impressions) },
                { icon: Megaphone, color: "text-primary", label: "Alcance", value: fmt(current.reach) },
                { icon: MousePointerClick, color: "text-success", label: "Clics", value: fmt(current.clicks) },
                { icon: Target, color: "text-warning", label: "Resultados", value: fmt(totalResults) },
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
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold sm:text-base">Costos</h2>
            <div className="mt-3 space-y-3 sm:mt-4">
              {[
                { icon: DollarSign, color: "text-info", label: "CPC", value: fmtMoney(current.cpc) },
                { icon: BarChart3, color: "text-primary", label: "CPM", value: fmtMoney(current.cpm) },
                { icon: DollarSign, color: "text-success", label: "Gasto Total", value: fmtMoney(current.spend) },
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
          </Card>
        </div>
      )}

      {tab === "campaigns" && (
        <Card>
          <div className="border-b border-border p-3 sm:p-4">
            <h2 className="text-sm font-semibold sm:text-base">Campañas ({campaignList.length})</h2>
          </div>
          {campaignList.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No se encontraron campañas"
              description="Esta cuenta de Meta Ads no tiene campañas en los últimos 6 meses."
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th scope="col" className="p-3 font-medium">Campaña</th>
                      <th scope="col" className="p-3 font-medium">Estado</th>
                      <th scope="col" className="p-3 font-medium text-right">Resultados</th>
                      <th scope="col" className="p-3 font-medium text-right">Costo/Resultado</th>
                      <th scope="col" className="p-3 font-medium text-right">Gasto</th>
                      <th scope="col" className="p-3 font-medium text-right">Alcance</th>
                      <th scope="col" className="p-3 font-medium text-right">Clics</th>
                      <th scope="col" className="p-3 font-medium text-right">CTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignList.map((c: any) => {
                      const st = statusLabel(c.status);
                      return (
                        <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/60">
                          <td className="p-3">
                            <p className="font-medium truncate max-w-[250px]">{c.name}</p>
                          </td>
                          <td className="p-3">
                            <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold", st.cls)}>{st.text}</span>
                          </td>
                          <td className="p-3 text-right">
                            {n(c.results) > 0 ? (
                              <>
                                <span className="block font-semibold">{fmt(c.results)}</span>
                                <span className="block text-xs text-muted-foreground">{c.resultType}</span>
                              </>
                            ) : "—"}
                          </td>
                          <td className="p-3 text-right">{n(c.costPerResult) > 0 ? fmtMoney(c.costPerResult) : "—"}</td>
                          <td className="p-3 text-right font-medium">{fmtMoney(c.spend)}</td>
                          <td className="p-3 text-right">{fmt(c.reach)}</td>
                          <td className="p-3 text-right">{fmt(c.clicks)}</td>
                          <td className="p-3 text-right">{n(c.ctr).toFixed(2)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-border md:hidden">
                {campaignList.map((c: any) => {
                  const st = statusLabel(c.status);
                  return (
                    <div key={c.id} className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate flex-1 mr-2">{c.name}</p>
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", st.cls)}>{st.text}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                        <div><span className="block font-medium text-foreground">{n(c.results) > 0 ? fmt(c.results) : "—"}</span>{n(c.results) > 0 ? c.resultType : "Resultados"}</div>
                        <div><span className="block font-medium text-foreground">{n(c.costPerResult) > 0 ? fmtMoney(c.costPerResult) : "—"}</span>Costo/Res.</div>
                        <div><span className="block font-medium text-foreground">{fmtMoney(c.spend)}</span>Gasto</div>
                        <div><span className="block font-medium text-foreground">{fmt(c.clicks)}</span>Clics</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      )}

      {tab === "history" && (
        <div className="space-y-4 sm:space-y-6">
          <Card className="p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2 sm:mb-6">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold sm:text-base">Gasto Mensual (6 meses)</h2>
            </div>
            {monthlyData.length === 0 ? (
              <EmptyState icon={History} title="Sin datos históricos" description="Aún no hay gasto registrado en los últimos 6 meses." className="py-8" />
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {monthlyData.map((m: any) => (
                  <div key={m.month} className="flex items-center gap-2 sm:gap-4">
                    <span className="w-16 text-xs text-muted-foreground shrink-0 sm:w-24 sm:text-sm">{m.month}</span>
                    <div className="h-6 flex-1 overflow-hidden rounded-lg bg-secondary sm:h-8">
                      {m.hasData === false && n(m.spend) === 0 ? (
                        <div className="h-full flex items-center px-2">
                          <span className="text-xs text-muted-foreground">Sin datos</span>
                        </div>
                      ) : (
                        <div className="h-full rounded-lg bg-primary" style={{ width: `${Math.max((n(m.spend) / maxSpend) * 100, 2)}%` }} />
                      )}
                    </div>
                    <span className={cn("w-20 text-xs font-semibold text-right shrink-0 sm:w-28 sm:text-sm", m.hasData === false && "text-muted-foreground")}>{fmtMoney(m.spend)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="border-b border-border p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold sm:text-base">Detalle Mensual</h2>
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
          </Card>
        </div>
      )}
    </div>
  );
}
