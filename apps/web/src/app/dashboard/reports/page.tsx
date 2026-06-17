"use client";

import { useState } from "react";
import { Sparkles, FileText, Calendar, Loader2, ChevronRight } from "lucide-react";

const pastReports = [
  {
    id: "1",
    title: "Reporte Mensual - Mayo 2024",
    date: "1 Jun 2024",
    summary: "Ingresos crecieron 8.3% con margen neto estable en 39%. Pipeline de ventas saludable con $6.2M en deals activos.",
    status: "COMPLETED" as const,
  },
  {
    id: "2",
    title: "Reporte Mensual - Abril 2024",
    date: "1 May 2024",
    summary: "Mes de consolidación. Gastos operativos reducidos 5%. Rotación de personal en mínimo histórico de 1.8%.",
    status: "COMPLETED" as const,
  },
  {
    id: "3",
    title: "Reporte Mensual - Marzo 2024",
    date: "1 Abr 2024",
    summary: "Crecimiento acelerado con 3 nuevos clientes enterprise. CAC reducido 12% gracias a canal orgánico.",
    status: "COMPLETED" as const,
  },
];

export default function ReportsPage() {
  const [generating, setGenerating] = useState(false);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 3000));
    setGenerating(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes IA</h1>
          <p className="text-sm text-muted-foreground">Análisis inteligente de tu negocio</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 rounded-xl gradient-bg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {generating ? "Generando..." : "Generar Reporte"}
        </button>
      </div>

      {generating && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-bg flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <p className="font-medium">Generando reporte con IA...</p>
              <p className="text-sm text-muted-foreground">Analizando métricas de finanzas, ventas, operaciones, RRHH y marketing</p>
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/5">
            <div className="h-2 rounded-full gradient-bg animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/5 bg-card p-6">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <FileText className="h-5 w-5 text-primary" />
          Último Reporte - Junio 2024
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Generado el 1 de julio, 2024</p>

        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm font-medium text-primary">Resumen Ejecutivo</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Los ingresos alcanzaron $620,000 MXN (+10.7% vs mayo), impulsados por el cierre de 3 deals enterprise
              con un valor promedio de $180,000. El margen neto mejoró a 41.9%, el más alto en 6 meses. La tasa de
              conversión de ventas bajó a 17.8% (-2.1pp), sugiriendo necesidad de optimizar el proceso de calificación.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-sm font-medium text-emerald-400">Fortalezas</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>- Crecimiento sostenido de ingresos por 4to mes</li>
                <li>- Margen neto en máximo histórico</li>
                <li>- Rotación de personal controlada (2.1%)</li>
              </ul>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-sm font-medium text-amber-400">Áreas de Mejora</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>- Tasa de conversión en descenso</li>
                <li>- CAC de Google Ads subiendo</li>
                <li>- Proyecto Expansión CDMX retrasado</li>
              </ul>
            </div>
          </div>

          <div className="rounded-lg border border-white/5 bg-white/5 p-4">
            <p className="text-sm font-medium">Recomendaciones</p>
            <div className="mt-3 space-y-2">
              {[
                { priority: "Alta", text: "Auditar pipeline de ventas: revisar criterios de calificación de leads para mejorar conversión" },
                { priority: "Alta", text: "Renegociar keywords de Google Ads: el CAC subió 15% — pausar campañas de bajo rendimiento" },
                { priority: "Media", text: "Acelerar proyecto CDMX: asignar recursos adicionales para recuperar timeline" },
                { priority: "Baja", text: "Evaluar expansión del programa de referidos: canal con mejor ROI y menor CAC" },
              ].map((rec, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    rec.priority === "Alta" ? "bg-red-500/10 text-red-400" :
                    rec.priority === "Media" ? "bg-amber-500/10 text-amber-400" :
                    "bg-blue-500/10 text-blue-400"
                  }`}>
                    {rec.priority}
                  </span>
                  <p className="text-sm text-muted-foreground">{rec.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-card p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          Reportes Anteriores
        </h3>
        <div className="mt-4 space-y-2">
          {pastReports.map((report) => (
            <button
              key={report.id}
              onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
              className="w-full rounded-lg border border-white/5 bg-white/[0.02] p-4 text-left transition-colors hover:bg-white/5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{report.title}</p>
                  <p className="text-xs text-muted-foreground">{report.date}</p>
                </div>
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expandedReport === report.id ? "rotate-90" : ""}`} />
              </div>
              {expandedReport === report.id && (
                <p className="mt-3 text-sm text-muted-foreground border-t border-white/5 pt-3">
                  {report.summary}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
