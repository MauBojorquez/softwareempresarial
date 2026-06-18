"use client";

import { useEffect, useState } from "react";
import { Sparkles, FileText, Calendar, Loader2, ChevronRight, LinkIcon, Download } from "lucide-react";
import { useToast } from "@/components/toast";

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
  const { toast } = useToast();
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
        toast(data.error || "Error al generar reporte", "error");
      } else {
        load();
        toast("Reporte generado exitosamente", "success");
      }
    } catch {
      toast("Error al generar reporte", "error");
    }
    setGenerating(false);
  };

  const downloadReport = async (id: string) => {
    const res = await fetch(`/api/reports/pdf?type=report&id=${id}`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Reporte-${id}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Reporte descargado", "success");
    }
  };

  const downloadMetrics = async () => {
    const res = await fetch("/api/reports/pdf?type=metrics");
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Metricas-${new Date().toISOString().split("T")[0]}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Métricas exportadas", "success");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const latestReport = reports[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Reportes IA
            {reports.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {reports.length}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">Análisis inteligente de tu negocio</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadMetrics}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exportar Métricas</span>
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 rounded-lg gradient-bg px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 sm:px-5 sm:py-2.5 sm:text-sm"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {generating ? "Generando..." : "Generar Reporte"}
          </button>
        </div>
      </div>

      {generating && (
        <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg gradient-bg flex items-center justify-center sm:h-10 sm:w-10 sm:rounded-xl">
              <Sparkles className="h-4 w-4 text-white animate-pulse sm:h-5 sm:w-5" />
            </div>
            <div>
              <p className="text-sm font-medium sm:text-base">Generando reporte con IA...</p>
              <p className="text-xs text-muted-foreground sm:text-sm">Analizando todas tus métricas registradas</p>
            </div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-secondary/50 sm:mt-4">
            <div className="h-2 rounded-full gradient-bg animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      )}

      {reports.length === 0 && !generating ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 sm:py-20 px-4">
          <LinkIcon className="h-8 w-8 text-muted-foreground mb-3 sm:h-10 sm:w-10 sm:mb-4" />
          <h3 className="text-base font-semibold sm:text-lg">Sin reportes generados</h3>
          <p className="mt-1 text-sm text-muted-foreground text-center max-w-md">
            Agrega datos en Finanzas, Ventas u otra sección y genera tu primer reporte.
          </p>
          <button onClick={handleGenerate} disabled={generating} className="mt-4 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            Generar Primer Reporte
          </button>
        </div>
      ) : latestReport ? (
        <>
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                  <FileText className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
                  {latestReport.title}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
                  {new Date(latestReport.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <button
                onClick={() => downloadReport(latestReport.id)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Descargar</span>
              </button>
            </div>

            <div className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
              <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 sm:p-4">
                <p className="text-xs font-medium text-primary sm:text-sm">Resumen Ejecutivo</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground whitespace-pre-line sm:mt-2 sm:text-sm">{latestReport.summary}</p>
              </div>

              {latestReport.content && (
                <div className="rounded-lg border border-border bg-secondary/50 p-3 sm:p-4">
                  <p className="text-xs font-medium sm:text-sm">Análisis Detallado</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground whitespace-pre-line sm:mt-2 sm:text-sm">{latestReport.content}</p>
                </div>
              )}
            </div>
          </div>

          {reports.length > 1 && (
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <h3 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                <Calendar className="h-4 w-4 text-muted-foreground sm:h-5 sm:w-5" />
                Reportes Anteriores
              </h3>
              <div className="mt-3 space-y-2 sm:mt-4">
                {reports.slice(1).map((report) => (
                  <div key={report.id} className="rounded-lg border border-border p-3 sm:p-4">
                    <button
                      onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium sm:text-sm">{report.title}</p>
                          <p className="text-[11px] text-muted-foreground sm:text-xs">{new Date(report.createdAt).toLocaleDateString("es-MX")}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); downloadReport(report.id); }}
                            className="rounded p-1 text-muted-foreground hover:text-foreground"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expandedReport === report.id ? "rotate-90" : ""}`} />
                        </div>
                      </div>
                    </button>
                    {expandedReport === report.id && (
                      <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-3 sm:text-sm">{report.summary}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
