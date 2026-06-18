"use client";

import { useEffect, useState } from "react";
import { Sparkles, FileText, Calendar, Loader2, ChevronRight, LinkIcon } from "lucide-react";

type Report = {
  id: string;
  title: string;
  summary: string;
  content: string;
  period: string;
  type: string;
  status: string;
  createdAt: string;
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  const load = () => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => { setReports(d.reports || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/reports/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || "Error al generar reporte");
      } else {
        load();
      }
    } catch {
      alert("Error al generar reporte");
    }
    setGenerating(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const latestReport = reports[0];

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
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? "Generando..." : "Generar Reporte"}
        </button>
      </div>

      {generating && (
        <div className="rounded-xl border border-primary/15 bg-primary/5 p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-bg flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <p className="font-medium">Generando reporte con IA...</p>
              <p className="text-sm text-muted-foreground">Analizando métricas de finanzas, ventas, operaciones, RRHH y marketing</p>
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-secondary/50">
            <div className="h-2 rounded-full gradient-bg animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      )}

      {reports.length === 0 && !generating ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20">
          <LinkIcon className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Sin reportes generados</h3>
          <p className="mt-1 text-sm text-muted-foreground text-center max-w-md">
            Agrega datos en las secciones de Finanzas, Ventas u otras categorías y genera tu primer reporte con IA.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="mt-4 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Generar Primer Reporte
          </button>
        </div>
      ) : latestReport ? (
        <>
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <FileText className="h-5 w-5 text-primary" />
              {latestReport.title}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Generado el {new Date(latestReport.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-primary/15 bg-primary/5 p-4">
                <p className="text-sm font-medium text-primary">Resumen Ejecutivo</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{latestReport.summary}</p>
              </div>

              {latestReport.content && (
                <div className="rounded-lg border border-border bg-secondary/50 p-4">
                  <p className="text-sm font-medium">Análisis Detallado</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{latestReport.content}</p>
                </div>
              )}
            </div>
          </div>

          {reports.length > 1 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                Reportes Anteriores
              </h3>
              <div className="mt-4 space-y-2">
                {reports.slice(1).map((report) => (
                  <button
                    key={report.id}
                    onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                    className="w-full rounded-lg border border-border p-4 text-left transition-colors hover:bg-secondary/50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{report.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(report.createdAt).toLocaleDateString("es-MX")}
                        </p>
                      </div>
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expandedReport === report.id ? "rotate-90" : ""}`} />
                    </div>
                    {expandedReport === report.id && (
                      <p className="mt-3 text-sm text-muted-foreground border-t border-border pt-3">{report.summary}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
