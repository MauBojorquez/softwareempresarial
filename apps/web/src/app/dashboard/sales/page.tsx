"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Users, UserPlus, TrendingUp, Target } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import Link from "next/link";

interface ContactStage {
  stage: string;
  label: string;
  count: number;
}

interface PipelineStage {
  stageId: string;
  label: string;
  count: number;
  amount: number;
}

interface HubSpotData {
  connected: boolean;
  error?: string;
  contacts?: {
    total: number;
    newThisMonth: number;
    byStage: ContactStage[];
  };
  pipeline?: {
    stages: PipelineStage[];
    closedWon: { count: number; amount: number };
    closedLost: { count: number };
  };
  lastSyncAt?: string;
}

interface ManualMetric {
  id: string;
  name: string;
  value: number;
  category: string;
  period: string;
}

function formatMXN(amount: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(amount);
}

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000 / 60);
  if (diff < 1) return "justo ahora";
  if (diff === 1) return "hace 1 min";
  return `hace ${diff} min`;
}

export default function SalesPage() {
  const [data, setData] = useState<HubSpotData | null>(null);
  const [manualMetrics, setManualMetrics] = useState<ManualMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState<string>("Todos");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/metrics/sales/hubspot");
      const json: HubSpotData = await res.json();
      setData(json);
      if (!json.connected) {
        const manualRes = await fetch("/api/metrics/manual?category=SALES&months=3");
        const manualJson = await manualRes.json();
        setManualMetrics(manualJson.metrics ?? []);
      }
    } catch {
      setData({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data?.connected) {
    return (
      <div className="space-y-6 p-6">
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8 text-center">
          <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Conecta HubSpot</h2>
          <p className="text-muted-foreground mb-4">Conecta HubSpot para ver tu pipeline de ventas en tiempo real</p>
          <Link
            href="/dashboard/integrations"
            className="inline-block gradient-bg text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Ir a Integraciones
          </Link>
        </div>
        {manualMetrics.length > 0 && (
          <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
            <h3 className="font-semibold mb-4">Métricas Manuales</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {manualMetrics.map((m) => (
                <div key={m.id} className="p-4 bg-secondary/50 rounded-xl">
                  <p className="text-sm text-muted-foreground capitalize">{m.name.replace(/_/g, " ")}</p>
                  <p className="text-2xl font-bold">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const { contacts, pipeline, lastSyncAt } = data;
  const pipelineValue = pipeline?.stages.reduce((sum, s) => sum + s.amount, 0) ?? 0;
  const maxDealCount = Math.max(...(pipeline?.stages.map((s) => s.count) ?? [1]), 1);

  const selectedCount =
    selectedStage === "Todos"
      ? (contacts?.total ?? 0)
      : (contacts?.byStage.find((s) => s.label === selectedStage)?.count ?? 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ventas</h1>
          {lastSyncAt && (
            <p className="text-sm text-muted-foreground mt-0.5">Última sincronización: {timeAgo(lastSyncAt)}</p>
          )}
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-sm text-muted-foreground hover:bg-secondary transition-colors shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Contactos"
          value={contacts?.total ?? 0}
          icon={Users}
        />
        <MetricCard
          title="Nuevos este Mes"
          value={contacts?.newThisMonth ?? 0}
          icon={UserPlus}
        />
        <MetricCard
          title="Pipeline Total"
          value={pipelineValue}
          format="currency"
          icon={TrendingUp}
        />
        <MetricCard
          title="Negocios Cerrados"
          value={pipeline?.closedWon.count ?? 0}
          icon={Target}
        />
      </div>

      {/* Contactos por Etapa */}
      <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
        <h2 className="text-lg font-semibold mb-4">Contactos por Etapa</h2>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          {["Todos", ...(contacts?.byStage.map((s) => s.label) ?? [])].map((label) => (
            <button
              key={label}
              onClick={() => setSelectedStage(label)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedStage === label
                  ? "gradient-bg text-white shadow-sm"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Big number */}
        <div className="mb-6">
          <span className="text-5xl font-bold">{selectedCount}</span>
          <span className="text-muted-foreground ml-2 text-lg">
            {selectedStage === "Todos" ? "contactos totales" : `en etapa ${selectedStage}`}
          </span>
        </div>

        {/* Bar chart */}
        <div className="space-y-3">
          {contacts?.byStage.map((s) => (
            <div key={s.stage} className="flex items-center gap-3">
              <span className="w-28 text-sm text-muted-foreground text-right shrink-0">{s.label}</span>
              <div className="flex-1 bg-secondary rounded-full h-3">
                <div
                  className="gradient-bg h-3 rounded-full transition-all"
                  style={{ width: `${Math.round((s.count / (contacts.total || 1)) * 100)}%` }}
                />
              </div>
              <span className="w-10 text-sm font-medium shrink-0">{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline de Negocios */}
      <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
        <h2 className="text-lg font-semibold mb-4">Pipeline de Negocios</h2>

        <div className="space-y-3 mb-6">
          {pipeline?.stages.map((s) => (
            <div key={s.stageId}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{s.label}</span>
                <div className="text-right">
                  <span className="text-sm font-semibold">{s.count} negocios</span>
                  <span className="text-xs text-muted-foreground ml-2">{formatMXN(s.amount)}</span>
                </div>
              </div>
              <div className="bg-secondary rounded-full h-2">
                <div
                  className="gradient-bg h-2 rounded-full transition-all"
                  style={{ width: `${Math.round((s.count / maxDealCount) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-center">
            <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide mb-1">Ganados</p>
            <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{pipeline?.closedWon.count ?? 0}</p>
            <p className="text-sm text-emerald-500 mt-0.5">{formatMXN(pipeline?.closedWon.amount ?? 0)}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
            <p className="text-xs text-red-600 font-medium uppercase tracking-wide mb-1">Perdidos</p>
            <p className="text-3xl font-bold text-red-700 dark:text-red-400">{pipeline?.closedLost.count ?? 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
