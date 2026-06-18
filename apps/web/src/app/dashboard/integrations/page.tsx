"use client";

import { useState, useEffect } from "react";
import { Plug, CheckCircle, ExternalLink, RefreshCw, AlertCircle, Loader2 } from "lucide-react";

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
    connectUrl: "/api/integrations/quickbooks",
  },
  {
    type: "HUBSPOT",
    name: "HubSpot",
    description: "Pipeline de ventas, deals, contactos y métricas de conversión en tiempo real.",
    category: "CRM",
    metrics: ["Pipeline", "Deals", "Conversión", "Leads", "Revenue"],
    color: "from-orange-500 to-red-500",
    connectUrl: "/api/integrations/hubspot",
  },
  {
    type: "META_ADS",
    name: "Meta Ads",
    description: "Métricas de campañas de Facebook e Instagram: gasto, ROAS, leads, conversiones.",
    category: "Publicidad Digital",
    metrics: ["Ad Spend", "ROAS", "CPC", "CTR", "Leads", "Conversiones", "Alcance"],
    color: "from-blue-500 to-indigo-600",
    connectUrl: "/api/integrations/meta",
  },
  {
    type: "GOOGLE_ANALYTICS",
    name: "Google Analytics",
    description: "Tráfico web, fuentes de adquisición, comportamiento de usuarios y conversiones.",
    category: "Marketing",
    metrics: ["Tráfico Web", "Bounce Rate", "Conversiones", "Sesiones"],
    color: "from-yellow-500 to-amber-500",
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
      .catch(() => {});
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
    } catch {}
    setSyncing((p) => ({ ...p, [type]: false }));
  };

  const handleConnect = (url: string) => {
    window.location.href = url;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integraciones</h1>
        <p className="text-sm text-muted-foreground">Conecta tus herramientas para sincronizar métricas</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {integrationConfig.map((integration) => {
          const connected = isConnected(integration.type);
          const status = getStatus(integration.type);
          const isSyncing = syncing[integration.type];

          return (
            <div
              key={integration.type}
              className="rounded-xl border border-white/5 bg-card p-6 transition-all hover:border-white/10"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${integration.color} flex items-center justify-center`}>
                    <Plug className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{integration.name}</h3>
                    <p className="text-xs text-muted-foreground">{integration.category}</p>
                  </div>
                </div>
                {connected ? (
                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                    <CheckCircle className="h-3 w-3" />
                    Conectado
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    <AlertCircle className="h-3 w-3" />
                    Desconectado
                  </div>
                )}
              </div>

              <p className="mt-3 text-sm text-muted-foreground">{integration.description}</p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {integration.metrics.map((metric) => (
                  <span key={metric} className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {metric}
                  </span>
                ))}
              </div>

              {connected && status && (
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{status.metricsCount} métricas sincronizadas</span>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
                {connected ? (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {status?.lastSyncAt ? `Última sync: ${timeAgo(status.lastSyncAt)}` : "Sin sincronizar"}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSync(integration.type)}
                        disabled={isSyncing}
                        className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/10 disabled:opacity-50"
                      >
                        {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        {isSyncing ? "Sincronizando..." : "Sincronizar"}
                      </button>
                      <button className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/10">
                        <ExternalLink className="h-3 w-3" />
                        Config
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
                    className="w-full rounded-lg bg-white/5 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed"
                  >
                    Próximamente
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-white/5 bg-card p-6">
        <h3 className="font-semibold">API Personalizada</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecta cualquier sistema vía REST API para enviar métricas personalizadas.
        </p>
        <div className="mt-4 rounded-lg border border-white/5 bg-black/30 p-4 font-mono text-xs text-muted-foreground">
          <p className="text-primary">POST /api/v1/metrics</p>
          <p className="mt-1">Authorization: Bearer {"<"}api_key{">"}</p>
          <p className="mt-2 text-emerald-400">{"{}"}</p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Disponible en planes Professional y Enterprise</p>
      </div>
    </div>
  );
}
