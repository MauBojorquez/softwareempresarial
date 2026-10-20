import { emailBase as base, escHtml as esc } from "@/server/services/email";
import type { ConsolidadoAI, PendientesAI, PendienteItem } from "@/server/services/ai/daily-ai";

const H3 = "margin:22px 0 8px;color:#18181b;font-size:15px;";
const P = "margin:4px 0;color:#3f3f46;font-size:14px;line-height:1.55;";
const MUTED = "color:#a1a1aa;font-size:12px;";

function list(itemsHtml: string[], empty: string): string {
  if (itemsHtml.length === 0) return `<p style="${P}${MUTED}">${esc(empty)}</p>`;
  return `<ul style="margin:0;padding-left:18px;">${itemsHtml
    .map((i) => `<li style="${P}">${i}</li>`)
    .join("")}</ul>`;
}

function callout(text: string, color: string): string {
  return `<p style="margin:6px 0;padding:10px 12px;background:#f4f4f5;border-left:3px solid ${color};border-radius:6px;color:#3f3f46;font-size:13px;line-height:1.5;">${esc(text)}</p>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;background:#224CA0;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;">${esc(label)}</a>`;
}

// ─── Consolidado diario del equipo ──────────────────────────────────

export type ConsolidadoPersona = {
  nombre: string;
  puesto: string;
  fecha: string;
  rows: { label: string; value: string }[];
  notas: string;
};

export function consolidadoEmail(input: {
  periodoTexto: string;
  ai: ConsolidadoAI | null;
  personas: ConsolidadoPersona[];
  faltantes: string[];
}) {
  const { ai } = input;
  const aiHtml = ai
    ? `<p style="${P}">${esc(ai.resumen)}</p>
       ${ai.alertas.length ? `<h3 style="${H3}">⚠️ Atender hoy</h3>${ai.alertas.map((a) => callout(a, "#dc2626")).join("")}` : ""}
       ${ai.destacados.length ? `<h3 style="${H3}">✅ Destacados</h3>${list(ai.destacados.map(esc), "")}` : ""}`
    : `<p style="${P}${MUTED}">El resumen de IA no estuvo disponible hoy; abajo va el detalle completo.</p>`;

  const faltantesHtml = input.faltantes.length
    ? callout(`No enviaron reporte: ${input.faltantes.join(", ")}`, "#d97706")
    : `<p style="${P}color:#16a34a;">✓ Todo el equipo envió su reporte.</p>`;

  const personasHtml = input.personas
    .map(
      (p) => `
      <div style="margin-top:14px;padding:14px 16px;border:1px solid #e4e4e7;border-radius:12px;">
        <p style="margin:0 0 6px;color:#18181b;font-size:14px;font-weight:700;">${esc(p.nombre)}
          <span style="font-weight:400;color:#71717a;"> · ${esc(p.puesto)} · ${esc(p.fecha)}</span></p>
        <table width="100%" cellpadding="0" cellspacing="0">${p.rows
          .map(
            (r) => `<tr><td style="padding:4px 0;color:#71717a;font-size:13px;">${esc(r.label)}</td>
              <td style="padding:4px 0;text-align:right;color:#18181b;font-size:13px;font-weight:600;">${esc(r.value)}</td></tr>`,
          )
          .join("")}</table>
        ${p.notas ? `<p style="margin:8px 0 0;color:#3f3f46;font-size:13px;line-height:1.5;"><em>${esc(p.notas)}</em></p>` : ""}
      </div>`,
    )
    .join("");

  return {
    subject: `Reporte del equipo · ${input.periodoTexto}`,
    html: base(`
      <h2 style="margin:0 0 4px;color:#18181b;font-size:20px;">Reporte del equipo</h2>
      <p style="${P}${MUTED}">${esc(input.periodoTexto)}</p>
      <h3 style="${H3}">Resumen</h3>
      ${aiHtml}
      ${faltantesHtml}
      <h3 style="${H3}">Detalle por persona</h3>
      ${personasHtml || `<p style="${P}${MUTED}">Nadie envió reporte en este periodo.</p>`}
      ${button(`${process.env.NEXTAUTH_URL}/dashboard/reportes`, "Ver reportes en la app")}
    `),
  };
}

// ─── Pendientes personales ──────────────────────────────────────────

export type PendientesDatos = {
  tareas: string[];
  rocas: string[];
  meta: string | null;
};

const withSource = (i: PendienteItem) =>
  `${esc(i.texto)}${i.fuente ? ` <span style="${MUTED}">— ${esc(i.fuente)}</span>` : ""}`;

export function pendientesEmail(input: {
  nombre: string;
  hoyTexto: string;
  ai: PendientesAI | null;
  datos: PendientesDatos;
  googleConectado: boolean;
}) {
  const { ai, datos } = input;
  const primerNombre = input.nombre.split(" ")[0] || input.nombre;

  const aiHtml = ai
    ? `${ai.resumen ? `<p style="${P}">${esc(ai.resumen)}</p>` : ""}
       ${ai.prioridades.length ? `<h3 style="${H3}">🎯 Tus 3 prioridades de hoy</h3>${list(ai.prioridades.map(esc), "")}` : ""}
       <h3 style="${H3}">🤝 Compromisos</h3>${list(ai.compromisos.map(withSource), "Sin compromisos abiertos detectados.")}
       <h3 style="${H3}">📨 Seguimientos pendientes</h3>${list(ai.seguimientos.map(withSource), "Sin seguimientos pendientes detectados.")}
       ${ai.incongruencias.length ? `<h3 style="${H3}">🔎 Cosas que no cuadran</h3>${ai.incongruencias.map((x) => callout(x, "#d97706")).join("")}` : ""}`
    : `<p style="${P}${MUTED}">El análisis de IA no estuvo disponible hoy; abajo van tus pendientes de la app.</p>`;

  const googleNote = input.googleConectado
    ? ""
    : `<p style="margin-top:20px;${P}${MUTED}">Conecta tu Google en Configuración para que también revise tus correos y reuniones.</p>`;

  return {
    subject: `Tus pendientes de hoy · ${input.hoyTexto}`,
    html: base(`
      <h2 style="margin:0 0 4px;color:#18181b;font-size:20px;">Buenos días, ${esc(primerNombre)}</h2>
      <p style="${P}${MUTED}">${esc(input.hoyTexto)} · Este correo es solo para ti.</p>
      ${aiHtml}
      <h3 style="${H3}">✅ Tareas vencidas o para hoy</h3>${list(datos.tareas.map(esc), "No tienes tareas vencidas ni para hoy.")}
      <h3 style="${H3}">🪨 Rocas en riesgo</h3>${list(datos.rocas.map(esc), "Tus rocas van en verde.")}
      ${datos.meta ? `<h3 style="${H3}">📈 Meta del mes</h3><p style="${P}">${esc(datos.meta)}</p>` : ""}
      ${googleNote}
      ${button(`${process.env.NEXTAUTH_URL}/dashboard/overview`, "Abrir StratiuMetrics")}
    `),
  };
}
