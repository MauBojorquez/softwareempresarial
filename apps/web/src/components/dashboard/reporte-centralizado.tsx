"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/toast";
import { useApi } from "@/hooks/use-api";
import { fechaLargaMX, todayMX } from "@/lib/day";
import { JOB_ROLE_LABEL, reportToText } from "@/lib/report-format";

type JobRole = keyof typeof JOB_ROLE_LABEL;

interface ReportesDelDia {
  fecha: string;
  reports: { userId: string; authorName: string | null; jobRole: JobRole | null; payload: unknown }[];
  members: { userId: string; name: string; submitted: boolean }[];
}

/** Every report of the day pasted together as-is: no AI, no summary. */
function juntar(d: ReportesDelDia): string {
  const partes = [`REPORTE CENTRALIZADO · ${fechaLargaMX(d.fecha)}`];
  const reports = [...d.reports].sort((a, b) => (a.authorName ?? "").localeCompare(b.authorName ?? "", "es"));
  for (const r of reports) {
    const puesto = r.jobRole ? JOB_ROLE_LABEL[r.jobRole] : "";
    partes.push(`${r.authorName ?? "Sin nombre"}${puesto ? ` — ${puesto}` : ""}\n${reportToText(r.jobRole, r.payload)}`);
  }
  if (reports.length === 0) partes.push("Nadie envió reporte este día.");
  const faltan = d.members.filter((m) => !m.submitted).map((m) => m.name);
  partes.push(faltan.length ? `No enviaron reporte: ${faltan.join(", ")}` : "Todo el equipo envió su reporte.");
  return partes.join("\n\n");
}

export function ReporteCentralizado() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ClipboardList /> Reporte centralizado
      </Button>
      {open && <ReporteDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function ReporteDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [fecha, setFecha] = useState(todayMX);
  const [copiado, setCopiado] = useState(false);
  const { data, error, loading, reload } = useApi<ReportesDelDia>(`/api/reportes?scope=all&fecha=${fecha}`);
  const texto = data && data.fecha === fecha ? juntar(data) : "";

  useEffect(() => setCopiado(false), [fecha]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast("Reporte copiado", "success");
    } catch {
      toast("No se pudo copiar; selecciona el texto y cópialo a mano", "error");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="lg"
        title="Reporte centralizado"
        description="Los reportes del día juntos, tal como los enviaron. Cópialo y pégalo donde lo necesites."
        footer={
          <>
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
            <Button onClick={copiar} disabled={!texto}>
              {copiado ? <Check /> : <Copy />} {copiado ? "Copiado" : "Copiar"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Día">
            <Input type="date" value={fecha} max={todayMX()} onChange={(e) => e.target.value && setFecha(e.target.value)} className="w-auto" />
          </Field>
          {error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : loading && !texto ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <Field label="Reporte">
              <Textarea readOnly value={texto} rows={16} className="font-mono text-xs leading-relaxed" onFocus={(e) => e.currentTarget.select()} />
            </Field>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
