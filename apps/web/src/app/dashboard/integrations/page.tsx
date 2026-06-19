"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast";
import { addActivityLog } from "@/components/dashboard/activity-log";
import {
  MetaLogo, HubSpotLogo, SATLogo,
} from "@/components/brand-logos";

type IntegrationStatus = {
  type: string;
  isActive: boolean;
  lastSyncAt: string | null;
  connectedAt: string;
  metricsCount: number;
};

type SatStatus = {
  connected: boolean;
  rfc?: string;
  syncStatus?: string;
  lastSyncAt?: string | null;
  lastError?: string | null;
};

const integrationConfig = [
  {
    type: "SAT",
    name: "SAT",
    description: "Tus finanzas reales desde tu CFDI: ingresos y gastos facturados automáticamente, sin captura manual.",
    category: "Finanzas / Fiscal",
    metrics: ["Ingresos facturados", "Gastos", "IVA", "Nómina", "Egresos", "Flujo de caja"],
    Logo: SATLogo,
    connectUrl: "/dashboard/integrations/sat",
  },
  {
    type: "HUBSPOT",
    name: "HubSpot",
    description: "Pipeline de ventas, deals, contactos y métricas de conversión en tiempo real.",
    category: "CRM",
    metrics: ["Pipeline", "Deals", "Conversión", "Leads", "Revenue"],
    Logo: HubSpotLogo,
    connectUrl: "/api/integrations/hubspot",
  },
  {
    type: "META_ADS",
    name: "Meta Ads",
    description: "Métricas de Facebook e Instagram Ads: gasto, alcance, conversiones y más.",
    category: "Publicidad Digital",
    metrics: ["Gasto", "Alcance", "Conversiones", "CTR", "CPC", "Impresiones"],
    Logo: MetaLogo,
    connectUrl: "/api/integrations/meta",
  },
];

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: "No se recibió el código de autorización. Intenta de nuevo.",
  invalid_state: "La sesión de conexión expiró o no coincidió. Vuelve a intentar.",
  meta_token_exchange: "Meta rechazó el intercambio de token. Revisa que la app y el redirect URI estén bien configurados.",
  meta_failed: "Falló la conexión con Meta. Intenta de nuevo.",
  token_exchange: "HubSpot rechazó el intercambio de token. Revisa la configuración de la app.",
  hubspot_failed: "Falló la conexión con HubSpot. Intenta de nuevo.",
  no_org: "No se encontró tu organización. Recarga la página.",
  limit: "Alcanzaste el límite de integraciones de tu plan.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  meta: "Meta Ads conectado correctamente",
  hubspot: "HubSpot conectado correctamente",
};

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
  const { toast } = useToast();
  const router = useRouter();
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [satStatus, setSatStatus] = useState<SatStatus>({ connected: false });

  const fetchSatStatus = () => {
    fetch("/api/integrations/sat/status")
      .then((r) => r.json())
      .then((d: SatStatus) => setSatStatus(d))
      .catch((e) => { console.error(e); });
  };

  useEffect(() => {
    fetch("/api/integrations/status")
      .then((r) => r.json())
      .then((d) => setStatuses(d.integrations ?? []))
      .catch((e) => { console.error(e); });
    fetchSatStatus();
  }, []);

  // Show feedback from OAuth callbacks (?success=... or ?error=...) so the
  // user understands why a connection "bounced" instead of seeing nothing.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const success = params.get("success");
    const message = params.get("message");
    if (success) {
      toast(SUCCESS_MESSAGES[success] ?? "Integración conectada", "success");
    } else if (error) {
      toast(message ? decodeURIComponent(message) : ERROR_MESSAGES[error] ?? `Error: ${error}`, "error");
    }
    if (error || success) {
      window.history.replaceState({}, "", "/dashboard/integrations");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isConnected = (type: string) => {
    if (type === "SAT") return satStatus.connected;
    return statuses.some((s) => s.type === type && s.isActive);
  };
  const getStatus = (type: string) => statuses.find((s) => s.type === type);

  const handleSatSync = async () => {
    setSyncing((p) => ({ ...p, SAT: true }));
    try {
      const res = await fetch("/api/integrations/sat/sync", { method: "POST" });
      const data = await res.json();
      fetchSatStatus();
      if (res.ok) {
        toast("SAT sincronizado correctamente", "success");
        addActivityLog("Sincronización", "SAT sincronizado", "sync");
      } else {
        toast(data.error ?? "Error sincronizando SAT", "error");
      }
    } catch (e) {
      console.error(e);
      toast("Error de conexión al sincronizar SAT", "error");
    }
    setSyncing((p) => ({ ...p, SAT: false }));
  };

  const handleSatDisconnect = async () => {
    if (!confirm("¿Desconectar SAT? Se dejará de sincronizar tus CFDIs.")) return;
    try {
      await fetch("/api/integrations/sat/disconnect", { method: "DELETE" });
      setSatStatus({ connected: false });
      toast("SAT desconectado", "success");
    } catch (e) {
      console.error(e);
      toast("Error al desconectar SAT", "error");
    }
  };

  const handleSync = async (type: string) => {
    setSyncing((p) => ({ ...p, [type]: true }));
    try {
      const syncRes = await fetch("/api/integrations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const syncData = await syncRes.json();
      const res = await fetch("/api/integrations/status");
      const data = await res.json();
      setStatuses(data.integrations ?? []);
      const result = syncData.results?.[type.toLowerCase()];
      if (result?.success) {
        toast(`${type} sincronizado: ${result.metricsCount || 0} métricas`, "success");
        addActivityLog("Sincronización", `${type} sincronizado`, "sync");
      } else {
        toast(`Error sincronizando ${type}`, "error");
      }
    } catch (e) {
      console.error(e);
      toast("Error de conexión al sincronizar", "error");
    }
    setSyncing((p) => ({ ...p, [type]: false }));
  };

  const handleConnect = (type: string, url: string) => {
    if (type === "SAT") {
      router.push(url);
    } else {
      window.location.href = url;
    }
  };

  const handleDisconnect = async (type: string) => {
    if (!confirm(`¿Desconectar ${type}? Se dejarán de sincronizar sus métricas.`)) return;
    try {
      await fetch("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const res = await fetch("/api/integrations/status");
      const data = await res.json();
      setStatuses(data.integrations ?? []);
      toast(`${type} desconectado`, "success");
    } catch (e) {
      console.error(e);
      toast("Error al desconectar", "error");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Integraciones</h1>
        <p className="text-sm text-muted-foreground">Conecta tus herramientas para sincronizar métricas</p>
      </div>

      {(statuses.length > 0 || satStatus.connected) && (
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium">{statuses.filter((s) => s.isActive).length + (satStatus.connected ? 1 : 0)} conectadas</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm text-muted-foreground">{integrationConfig.length} disponibles</span>
        </div>
      )}

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
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white shadow-sm">
                    <integration.Logo className="h-6 w-6" />
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

              {connected && integration.type === "SAT" && (() => {
                const lastSync = satStatus.lastSyncAt;
                const syncAge = lastSync ? (Date.now() - new Date(lastSync).getTime()) / 3600000 : Infinity;
                const dotColor = syncAge < 24 ? "bg-emerald-500" : syncAge < 168 ? "bg-yellow-500" : "bg-red-500";
                return (
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <div className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                      <span>RFC: {satStatus.rfc}</span>
                    </div>
                    {lastSync && <span className="font-medium">{timeAgo(lastSync)}</span>}
                    {satStatus.syncStatus === "syncing" && (
                      <span className="flex items-center gap-1 text-blue-500">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Sincronizando...
                      </span>
                    )}
                  </div>
                );
              })()}

              {connected && integration.type !== "SAT" && status && (() => {
                const syncAge = status.lastSyncAt ? (Date.now() - new Date(status.lastSyncAt).getTime()) / 3600000 : Infinity;
                const dotColor = syncAge < 24 ? "bg-emerald-500" : syncAge < 168 ? "bg-yellow-500" : "bg-red-500";
                return (
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <div className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                      <span>{status.metricsCount} métricas sincronizadas</span>
                    </div>
                    {status.lastSyncAt && (
                      <span className="font-medium">{timeAgo(status.lastSyncAt)}</span>
                    )}
                  </div>
                );
              })()}

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4">
                {connected ? (
                  integration.type === "SAT" ? (
                    <>
                      <span className="text-xs text-muted-foreground">
                        {satStatus.lastSyncAt ? `Última sync: ${timeAgo(satStatus.lastSyncAt)}` : "Sin sincronizar"}
                      </span>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          onClick={handleSatSync}
                          disabled={isSyncing || satStatus.syncStatus === "syncing"}
                          className="flex items-center gap-1.5 rounded-lg bg-secondary/50 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50"
                        >
                          {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          {isSyncing ? "Sincronizando..." : "Sincronizar"}
                        </button>
                        <button
                          onClick={handleSatDisconnect}
                          className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/20"
                        >
                          Desconectar
                        </button>
                      </div>
                    </>
                  ) : (
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
                  )
                ) : integration.connectUrl ? (
                  <button
                    onClick={() => handleConnect(integration.type, integration.connectUrl!)}
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
          <p className="mt-1 text-slate-400">Authorization: Bearer mp_abc...xyz</p>
          <p className="mt-1 text-slate-400">Content-Type: application/json</p>
          <p className="mt-2 text-emerald-400">{"{"}</p>
          <p className="text-emerald-400 pl-4">&quot;category&quot;: &quot;FINANCE&quot;,</p>
          <p className="text-emerald-400 pl-4">&quot;name&quot;: &quot;Ingresos&quot;,</p>
          <p className="text-emerald-400 pl-4">&quot;value&quot;: 150000,</p>
          <p className="text-emerald-400 pl-4">&quot;unit&quot;: &quot;MXN&quot;</p>
          <p className="text-emerald-400">{"}"}</p>
        </div>
        <a
          href="/dashboard/settings"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Crear API Key en Configuración
        </a>
      </div>
    </div>
  );
}
