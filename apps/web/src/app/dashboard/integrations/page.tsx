"use client";

import { useState, useEffect } from "react";
import { CheckCircle, RefreshCw, AlertCircle, Loader2 } from "lucide-react";

type IntegrationStatus = {
  type: string;
  isActive: boolean;
  lastSyncAt: string | null;
  connectedAt: string;
  metricsCount: number;
};

const integrationConfig = [
  {
    type: "QUICKBOOKS",
    name: "QuickBooks",
    description: "Sincroniza ingresos, gastos, P&L, balance y flujo de caja automáticamente.",
    category: "ERP / Contabilidad",
    metrics: ["Ingresos", "Gastos", "Utilidad Neta", "Flujo de Caja", "Cuentas por Cobrar"],
    color: "from-green-500 to-emerald-600",
    logo: "QB",
    connectUrl: "/api/integrations/quickbooks",
  },
  {
    type: "HUBSPOT",
    name: "HubSpot",
    description: "Pipeline de ventas, deals, contactos y métricas de conversión en tiempo real.",
    category: "CRM",
    metrics: ["Pipeline", "Deals", "Conversión", "Leads", "Revenue"],
    color: "from-orange-500 to-red-500",
    logo: "HS",
    connectUrl: "/api/integrations/hubspot",
  },
  {
    type: "META_ADS",
    name: "Meta Ads",
    description: "Métricas de Facebook e Instagram Ads: gasto, alcance, conversiones y más.",
    category: "Publicidad Digital",
    metrics: ["Gasto", "Alcance", "Conversiones", "CTR", "CPC", "Impresiones"],
    color: "from-blue-500 to-indigo-600",
    logo: "M",
    connectUrl: "/api/integrations/meta",
  },
  {
    type: "GOOGLE_ANALYTICS",
    name: "Google Analytics",
    description: "Tráfico web, fuentes de adquisición, comportamiento de usuarios y conversiones.",
    category: "Marketing",
    metrics: ["Tráfico Web", "Bounce Rate", "Conversiones", "Sesiones"],
    color: "from-yellow-500 to-amber-500",
    logo: "GA",
    connectUrl: null,
  },
  {
    type: "SLACK",
    name: "Slack",
    description: "Recibe alertas y reportes IA directamente en tus canales de Slack.",
    category: "Comunicación",
    metrics: ["Notificaciones", "Alertas", "Reportes"],
    color: "from-purple-500 to-violet-600",
    logo: "S",
    connectUrl: null,
  },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Justo ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  return `Hace ${Math.floor(hrs / 24)}d`;
}

export default function IntegrationsPage() {
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/integrations/status")
      .then((r) => r.json())
      .then((d) => setStatuses(d.integrations ?? []))
      .catch((e) => { console.error(e); });
  }, []);

  const isConnected = (type: string) => statuses.some((s) => s.type === type && s.isActive);
  const getStatus = (type: string) => statuses.find((s) => s.type === type);

  const handleSync = async (type: string) => {
    setSyncing((p) => ({ ...p, [type]: true }));
    try {
      await fetch("/api/integrations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const res = await fetch("/api/integrations/status");
      const data = await res.json();
      setStatuses(data.integrations ?? []);
    } catch (e) { console.error(e); }
    setSyncing((p) => ({ ...p, [type]: false }));
  };

  const handleConnect = (url: string) => {
    window.location.href = url;
  };

  const handleDisconnect = async (type: string) => {
    try {
      await fetch("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const res = await fetch("/api/integrations/status");
      const data = await res.json();
      setStatuses(data.integrations ?? []);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Integraciones</h1>
        <p className="text-sm text-muted-foreground">Conecta tus herramientas para sincronizar métricas</p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {integrationConfig.map((integration) => {
          const connected = isConnected(integration.type);
          const status = getStatus(integration.type);
          const isSyncing = syncing[integration.type];

          return (
            <div
              key={integration.type}
              className="rounded-xl border border-border bg-card p-4 sm:p-6 transition-all hover:border-border"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${integration.color} flex items-center justify-center text-white text-xs font-bold`}>
                    {integration.logo}
                  </div>
                  <div>
                    <h3 className="font-semibold">{integration.name}</h3>
                    <p className="text-xs text-muted-foreground">{integration.category}</p>
                  </div>
                </div>
                {connected ? (
                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600">
                    <CheckCircle className="h-3 w-3" />
                    Conectado
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-full bg-secondary/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    <AlertCircle className="h-3 w-3" />
                    Desconectado
                  </div>
                )}
              </div>

              <p className="mt-3 text-sm text-muted-foreground">{integration.description}</p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {integration.metrics.map((metric) => (
                  <span key={metric} className="rounded-md bg-secondary/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {metric}
                  </span>
                ))}
              </div>

              {connected && status && (
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{status.metricsCount} métricas sincronizadas</span>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4">
                {connected ? (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {status?.lastSyncAt ? `Última sync: ${timeAgo(status.lastSyncAt)}` : "Sin sincronizar"}
                    </span>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleSync(integration.type)}
                        disabled={isSyncing}
                        className="flex items-center gap-1.5 rounded-lg bg-secondary/50 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50"
                      >
                        {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        {isSyncing ? "Sincronizando..." : "Sincronizar"}
                      </button>
                      <button
                        onClick={() => handleDisconnect(integration.type)}
                        className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/20"
                      >
                        Desconectar
                      </button>
                    </div>
                  </>
                ) : integration.connectUrl ? (
                  <button
                    onClick={() => handleConnect(integration.connectUrl!)}
                    className="w-full rounded-lg gradient-bg py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  >
                    Conectar {integration.name}
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full rounded-lg bg-secondary/50 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed"
                  >
                    Próximamente
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <h3 className="font-semibold">API Personalizada</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecta cualquier sistema vía REST API para enviar métricas personalizadas.
        </p>
        <div className="mt-4 rounded-lg border border-border bg-slate-900 p-4 font-mono text-xs text-slate-300">
          <p className="text-blue-400">POST /api/v1/metrics</p>
          <p className="mt-1 text-slate-400">Authorization: Bearer {"<"}api_key{">"}</p>
          <p className="mt-2 text-emerald-400">{"{}"}</p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Disponible en planes Professional y Enterprise</p>
      </div>
    </div>
  );
}
