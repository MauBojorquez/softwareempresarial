import { db } from "@/server/db";
import { periodoTextoMX, previousBusinessSpanMX, todayMX } from "@/lib/day";
import { SUBMITTER_ROLES } from "@/lib/daily-report";
import { JOB_ROLE_LABEL, formatReportPayload, reportToText } from "@/lib/report-format";
import { summarizeConsolidado, type ConsolidadoAI } from "@/server/services/ai/daily-ai";
import { sendEmail } from "@/server/services/email";
import { consolidadoEmail, type ConsolidadoPersona } from "@/server/services/email/daily-emails";
import { contextoMesTexto } from "./context";

/**
 * Builds the director's morning digest: every daily report from the previous
 * business day through yesterday (Monday covers Fri–Sun), an AI summary on top,
 * and who did not submit. Sent only to DIRECCION members. Uses daily reports
 * and app data only — never anyone's email.
 */
export async function runConsolidado(orgId: string, opts: { today?: string; dryRun?: boolean } = {}) {
  const today = opts.today ?? todayMX();
  const days = previousBusinessSpanMX(today);
  const businessDay = days[0];
  const periodoTexto = periodoTextoMX(days);

  const [reports, submitters, direccion] = await Promise.all([
    db.dailyReport.findMany({
      where: { organizationId: orgId, fecha: { in: days } },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ fecha: "asc" }],
    }),
    db.membership.findMany({
      where: { organizationId: orgId, jobRole: { in: SUBMITTER_ROLES } },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    db.membership.findMany({
      where: { organizationId: orgId, jobRole: "DIRECCION" },
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const nameOf = (u: { name: string | null; email: string }) => u.name ?? u.email;

  const personas: ConsolidadoPersona[] = reports
    .map((r) => {
      const { rows, notas } = formatReportPayload(r.jobRole, r.payload);
      return {
        nombre: nameOf(r.user),
        puesto: r.jobRole ? JOB_ROLE_LABEL[r.jobRole] : "—",
        fecha: r.fecha,
        rows,
        notas,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es") || a.fecha.localeCompare(b.fecha));

  // "Faltante" = a submitter with no report on the business day itself.
  const sentBusinessDay = new Set(reports.filter((r) => r.fecha === businessDay).map((r) => r.userId));
  const faltantes = submitters
    .filter((m) => !sentBusinessDay.has(m.userId))
    .map((m) => nameOf(m.user))
    .sort((a, b) => a.localeCompare(b, "es"));

  let ai: ConsolidadoAI | null = null;
  let aiError: string | null = null;
  try {
    const reportesTexto = reports
      .map((r) => `${nameOf(r.user)} (${r.jobRole ? JOB_ROLE_LABEL[r.jobRole] : "—"}, ${r.fecha}):\n${reportToText(r.jobRole, r.payload)}`)
      .join("\n\n");
    ai = await summarizeConsolidado({
      periodoTexto,
      reportesTexto,
      faltantes,
      contextoTexto: await contextoMesTexto(orgId),
    });
  } catch (e) {
    aiError = e instanceof Error ? e.message : String(e);
    console.error("[consolidado] AI failed:", e);
  }

  const email = consolidadoEmail({ periodoTexto, ai, personas, faltantes });
  const recipients = direccion.map((m) => m.user.email).filter(Boolean);

  if (!opts.dryRun) {
    for (const to of recipients) await sendEmail(to, email.subject, email.html);
  }

  return {
    periodo: days,
    periodoTexto,
    reportes: reports.length,
    faltantes,
    destinatarios: recipients,
    enviado: !opts.dryRun && recipients.length > 0,
    ia: ai ? "ok" : `no disponible${aiError ? `: ${aiError}` : ""}`,
    ...(opts.dryRun ? { subject: email.subject, html: email.html } : {}),
  };
}
