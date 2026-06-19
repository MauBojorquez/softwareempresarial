"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Sparkles, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Anomaly = {
  metric: string;
  category: string;
  severity: "info" | "warning" | "critical";
  direction: "up" | "down";
  changePct: number;
  message: string;
};

type ForecastSeries = {
  metric: string;
  trend: "up" | "down" | "flat";
  nextValue: number;
  nextChangePct: number;
  history: { month: string; value: number; projected: boolean }[];
  forecast: { month: string; value: number; projected: boolean }[];
};

const fmtMoney = (v: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(v);

const sevStyle: Record<string, string> = {
  critical: "border-l-red-500 bg-red-500/5",
  warning: "border-l-amber-500 bg-amber-500/5",
  info: "border-l-blue-500 bg-blue-500/5",
};

export function InsightsWidget() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [forecasts, setForecasts] = useState<ForecastSeries[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/insights").then((r) => r.json()).catch(() => ({ anomalies: [] })),
      fetch("/api/insights/forecast").then((r) => r.json()).catch(() => ({ forecasts: [] })),
    ]).then(([a, f]) => {
      setAnomalies(Array.isArray(a.anomalies) ? a.anomalies : []);
      setForecasts(Array.isArray(f.forecasts) ? f.forecasts : []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (anomalies.length === 0 && forecasts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">IA Proactiva</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Cuando tengas al menos 2-3 meses de datos, aquí aparecerán alertas automáticas y proyecciones inteligentes.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
      {/* Anomalies */}
      <div className="rounded-xl border border-border bg-card p-5 card-hover">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold">Alertas inteligentes</h3>
          {anomalies.length > 0 && (
            <span className="ml-auto rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
              {anomalies.length}
            </span>
          )}
        </div>
        {anomalies.length === 0 ? (
          <p className="text-sm text-emerald-600 py-2">✓ Todo en orden, sin anomalías relevantes.</p>
        ) : (
          <div className="space-y-2">
            {anomalies.slice(0, 4).map((a, i) => (
              <div key={i} className={cn("rounded-lg border-l-2 px-3 py-2", sevStyle[a.severity])}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{a.metric}</span>
                  <span className={cn("flex items-center gap-0.5 text-xs font-semibold", a.direction === "up" ? "text-emerald-600" : "text-red-600")}>
                    {a.direction === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {a.changePct > 0 ? "+" : ""}{a.changePct}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{a.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Forecast */}
      <div className="rounded-xl border border-border bg-card p-5 card-hover">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Proyección (próximo mes)</h3>
        </div>
        {forecasts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Agrega más meses de datos para proyectar.</p>
        ) : (
          <div className="space-y-3">
            {forecasts.slice(0, 4).map((f) => {
              const TrendIcon = f.trend === "up" ? TrendingUp : f.trend === "down" ? TrendingDown : Minus;
              const trendColor = f.trend === "up" ? "text-emerald-600" : f.trend === "down" ? "text-red-600" : "text-muted-foreground";
              return (
                <div key={f.metric} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <TrendIcon className={cn("h-4 w-4 flex-shrink-0", trendColor)} />
                    <span className="text-sm truncate">{f.metric}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{fmtMoney(f.nextValue)}</p>
                    <p className={cn("text-[11px]", f.nextChangePct >= 0 ? "text-emerald-600" : "text-red-600")}>
                      {f.nextChangePct > 0 ? "+" : ""}{f.nextChangePct}% vs mes actual
                    </p>
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-muted-foreground pt-2 border-t border-border">
              Proyección basada en tendencia y estacionalidad de tus datos. Es estimada, no garantizada.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
