import { db } from "@/server/db";
import { dayRangeMX, fechaLargaMX, previousBusinessSpanMX, todayMX } from "@/lib/day";
import { JOB_ROLE_LABEL, reportToText } from "@/lib/report-format";
import { buildPendientes, type PendientesAI } from "@/server/services/ai/daily-ai";
import { sendEmail } from "@/server/services/email";
import { pendientesEmail } from "@/server/services/email/daily-emails";
import { getGoogleContext } from "@/server/services/google/context";
import { datosPersonales, metaPorPuesto } from "./context";

export class NotMemberError extends Error {}

/**
 * Builds and sends one collaborator's 9:50am pendientes email. Sent ONLY to
 * that person. Combines app data (overdue tasks, at-risk rocas, monthly goal,
 * last report) with their own Gmail + Meet notes when Google is connected.
 * Email/Drive content is used in memory only and never stored.
 */
export async function runPendientes(
  orgId: string,
  userId: string,
  opts: { today?: string; dryRun?: boolean } = {},
) {
  const member = await db.membership.findFirst({
    where: { organizationId: orgId, userId },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!member) throw new NotMemberError();

  const nombre = member.user.name ?? member.user.email;
  const puesto = member.jobRole ? JOB_ROLE_LABEL[member.jobRole] : "Colaborador";
  const today = opts.today ?? todayMX();
  const hoyTexto = fechaLargaMX(today);

  // Window: from the start of the previous business day (Monday → Friday).
  const span = previousBusinessSpanMX(today);
  const since = dayRangeMX(span[0]).start;

  const [datos, meta, reportes, google] = await Promise.all([
    datosPersonales(orgId, userId),
    metaPorPuesto(orgId, userId, member.jobRole),
    db.dailyReport.findMany({
      where: { organizationId: orgId, userId, fecha: { in: span } },
      orderBy: { fecha: "asc" },
    }),
    getGoogleContext(userId, since),
  ]);

  const appTexto = [
    `Tareas vencidas o que vencen hoy:\n${datos.tareas.map((t) => `- ${t}`).join("\n") || "- (ninguna)"}`,
    `Rocas del mes:\n${datos.rocasTexto}`,
    `Meta del mes: ${meta ?? "(sin meta para su puesto)"}`,
    `Su último reporte diario:\n${
      reportes.map((r) => `${r.fecha}:\n${reportToText(r.jobRole, r.payload)}`).join("\n") || "- (no envió reporte)"
    }`,
  ].join("\n\n");

  let ai: PendientesAI | null = null;
  let aiError: string | null = null;
  try {
    ai = await buildPendientes({
      nombre,
      puesto,
      hoyTexto,
      appTexto,
      correosTexto: google?.correosTexto ?? null,
      sesionesTexto: google?.sesionesTexto ?? null,
    });
  } catch (e) {
    aiError = e instanceof Error ? e.message : String(e);
    console.error("[pendientes] AI failed for", userId, e);
  }

  const email = pendientesEmail({
    nombre,
    hoyTexto,
    ai,
    datos: { tareas: datos.tareas, rocas: datos.rocasRiesgo, meta },
    googleConectado: !!google,
  });

  if (!opts.dryRun) await sendEmail(member.user.email, email.subject, email.html);

  // The response never includes email/Drive content: only counts and status.
  return {
    destinatario: member.user.email,
    enviado: !opts.dryRun,
    google: google ? (google.errores.length ? `conectado con errores: ${google.errores.join("; ")}` : "conectado") : "no conectado",
    ia: ai ? "ok" : `no disponible${aiError ? `: ${aiError}` : ""}`,
    tareas: datos.tareas.length,
    rocasEnRiesgo: datos.rocasRiesgo.length,
    ...(ai ? { compromisos: ai.compromisos.length, seguimientos: ai.seguimientos.length, incongruencias: ai.incongruencias.length } : {}),
    // Preview HTML only when it contains no email/Meet-derived content: the API
    // key holder must not be able to read someone else's inbox through it.
    ...(opts.dryRun && !google ? { subject: email.subject, html: email.html } : {}),
    ...(opts.dryRun && google ? { nota: "Vista previa oculta: incluye contenido del correo de esta persona." } : {}),
  };
}
