"use client";

import { Plug, CheckCircle, ExternalLink, RefreshCw, AlertCircle } from "lucide-react";

const integrations = [
  {
    id: "quickbooks",
    name: "QuickBooks",
    description: "Sincroniza ingresos, gastos, P&L, balance y flujo de caja automáticamente.",
    category: "ERP / Contabilidad",
    connected: true,
    lastSync: "Hace 2 horas",
    metrics: ["Ingresos", "Gastos", "Utilidad Neta", "Flujo de Caja", "Cuentas por Cobrar"],
    color: "from-green-500 to-emerald-600",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Pipeline de ventas, deals, contactos y métricas de conversión en tiempo real.",
    category: "CRM",
    connected: true,
    lastSync: "Hace 30 minutos",
    metrics: ["Pipeline", "Deals", "Conversión", "Leads", "Revenue"],
    color: "from-orange-500 to-red-500",
  },
  {
    id: "google-analytics",
    name: "Google Analytics",
    description: "Tráfico web, fuentes de adquisición, comportamiento de usuarios y conversiones.",
    category: "Marketing",
    connected: false,
    metrics: ["Tráfico Web", "Bounce Rate", "Conversiones", "Sesiones"],
    color: "from-yellow-500 to-amber-500",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Recibe alertas y reportes IA directamente en tus canales de Slack.",
    category: "Comunicación",
    connected: false,
    metrics: ["Notificaciones", "Alertas", "Reportes"],
    color: "from-purple-500 to-violet-600",
  },
];

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integraciones</h1>
        <p className="text-sm text-muted-foreground">Conecta tus herramientas para sincronizar métricas</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {integrations.map((integration) => (
          <div
            key={integration.id}
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
              {integration.connected ? (
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

            <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
              {integration.connected ? (
                <>
                  <span className="text-xs text-muted-foreground">
                    Última sync: {integration.lastSync}
                  </span>
                  <div className="flex gap-2">
                    <button className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/10">
                      <RefreshCw className="h-3 w-3" />
                      Sincronizar
                    </button>
                    <button className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/10">
                      <ExternalLink className="h-3 w-3" />
                      Config
                    </button>
                  </div>
                </>
              ) : (
                <button className="w-full rounded-lg gradient-bg py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
                  Conectar {integration.name}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/5 bg-card p-6">
        <h3 className="font-semibold">API Personalizada</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecta cualquier sistema vía REST API para enviar métricas personalizadas.
        </p>
        <div className="mt-4 rounded-lg border border-white/5 bg-black/30 p-4 font-mono text-xs text-muted-foreground">
          <p className="text-primary">POST /api/v1/metrics</p>
          <p className="mt-1">Authorization: Bearer {"<"}api_key{">"}</p>
          <p className="mt-2 text-emerald-400">{"{"}</p>
          <p className="ml-4">{'"category": "OPERATIONS",'}</p>
          <p className="ml-4">{'"name": "delivery_time",'}</p>
          <p className="ml-4">{'"value": 4.2,'}</p>
          <p className="ml-4">{'"unit": "days"'}</p>
          <p className="text-emerald-400">{"}"}</p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Disponible en planes Professional y Enterprise</p>
      </div>
    </div>
  );
}
