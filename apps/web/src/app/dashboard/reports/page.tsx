"use client";

import { useEffect, useState } from "react";
import { Sparkles, FileText, Calendar, Loader2, ChevronRight, BarChart3, Download } from "lucide-react";
import { useToast } from "@/components/toast";
import { addActivityLog } from "@/components/dashboard/activity-log";

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
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingMetrics, setDownloadingMetrics] = useState(false);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  const load = () => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => { setReports(d.reports || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Polls the reports list until the target report finishes (or any new report
  // stops being GENERATING). Returns the ready report, or null on timeout.
  const pollUntilReady = async (knownId?: string): Promise<Report | null> => {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const d = await fetch("/api/reports").then((r) => r.json());
        if (d?.reports) {
          setReports(d.reports);
          const target: Report | undefined = knownId
            ? d.reports.find((r: Report) => r.id === knownId)
            : d.reports[0];
          if (target && target.status !== "GENERATING") return target;
        }
      } catch {
        // keep polling
      }
    }
    return null;
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      let reportId: string | undefined;
      let postError: string | undefined;
      try {
        const res = await fetch("/api/reports/generate", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (res.ok) reportId = data.reportId;
        else postError = data.error || "Error al generar reporte";
      } catch {
        // The request may have timed out at the platform even though the
        // report keeps generating server-side — fall through to polling.
      }

      // Poll until the report is ready, so it appears on its own without a
      // manual page refresh (even if the POST connection dropped).
      const ready = await pollUntilReady(reportId);
      if (ready && ready.status === "COMPLETED") {
        setExpandedReport(ready.id);
        toast("Reporte generado exitosamente", "success");
        addActivityLog("Reporte IA generado", "Análisis mensual con IA", "report");
      } else if (postError) {
        toast(postError, "error");
      } else if (ready && ready.status === "FAILED") {
        toast("El reporte no se pudo generar. Verifica que tengas datos.", "error");
      } else {
        toast("El reporte está tardando más de lo normal. Aparecerá en la lista cuando termine.", "info");
        load();
      }
    } finally {
      setGenerating(false);
    }
  };

  const downloadReport = async (id: string) => {
    if (downloadingId) return;
    setDownloadingId(id);
    try {
      const res = await fetch(`/api/reports/pdf?type=report&id=${id}`);
      if (!res.ok) { toast("No se pudo descargar el reporte", "error"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Reporte-${id}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Reporte descargado", "success");
    } catch {
      toast("Error de conexión", "error");
    } finally {
      setDownloadingId(null);
    }
  };

  const downloadMetrics = async () => {
    if (downloadingMetrics) return;
    setDownloadingMetrics(true);
    try {
      const res = await fetch("/api/reports/pdf?type=metrics");
      if (!res.ok) { toast("No se pudo exportar las métricas", "error"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Metricas-${new Date().toISOString().split("T")[0]}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Métricas exportadas", "success");
    } catch {
      toast("Error de conexión", "error");
    } finally {
      setDownloadingMetrics(false);
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
            disabled={downloadingMetrics}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50"
          >
            {downloadingMetrics ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{downloadingMetrics ? "Exportando..." : "Exportar Métricas"}</span>
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
        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 sm:p-6">
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
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-16 sm:py-20 px-4">
          <BarChart3 className="h-8 w-8 text-muted-foreground mb-3 sm:h-10 sm:w-10 sm:mb-4" />
          <h3 className="text-base font-semibold sm:text-lg">Sin reportes generados</h3>
          <p className="mt-1 text-sm text-muted-foreground text-center max-w-md">
            Agrega datos en Finanzas, Ventas u otra sección y genera tu primer reporte.
          </p>
          <button onClick={handleGenerate} disabled={generating} className="mt-4 flex items-center gap-2 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {generating ? "Generando..." : "Generar Primer Reporte"}
          </button>
        </div>
      ) : latestReport ? (
        <>
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
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
                disabled={!!downloadingId}
                className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
              >
                {downloadingId === latestReport.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{downloadingId === latestReport.id ? "Descargando..." : "Descargar"}</span>
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
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <h3 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                <Calendar className="h-4 w-4 text-muted-foreground sm:h-5 sm:w-5" />
                Reportes Anteriores
              </h3>
              <div className="mt-3 space-y-2 sm:mt-4">
                {reports.slice(1).map((report) => (
                  <div key={report.id} className="rounded-lg border border-border p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                        aria-expanded={expandedReport === report.id}
                        className="flex flex-1 items-center justify-between gap-2 text-left"
                      >
                        <div>
                          <p className="text-xs font-medium sm:text-sm">{report.title}</p>
                          <p className="text-[11px] text-muted-foreground sm:text-xs">{new Date(report.createdAt).toLocaleDateString("es-MX")}</p>
                        </div>
                        <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expandedReport === report.id ? "rotate-90" : ""}`} />
                      </button>
                      <button
                        onClick={() => downloadReport(report.id)}
                        aria-label="Descargar reporte"
                        className="rounded p-1 text-muted-foreground hover:text-foreground"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
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
