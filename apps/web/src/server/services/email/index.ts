// EMAIL_FROM must use a domain verified in Resend (resend.com → Domains).
// For testing without a verified domain, use "onboarding@resend.dev" but
// Resend only allows sending to the account owner's email in that case.
const FROM = process.env.EMAIL_FROM ?? "StratiuMetrics <onboarding@resend.dev>";
const RESEND_KEY = process.env.RESEND_API_KEY_2 ?? process.env.RESEND_API_KEY;

export async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_KEY) {
    console.error("[email] RESEND_API_KEY_2 not set — email NOT sent:", subject, "→", to);
    return;
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_KEY);
    const result = await resend.emails.send({ from: FROM, to, subject, html });
    if (result.error) {
      console.error("[email] Resend error:", result.error, "subject:", subject, "to:", to);
    } else {
      console.log("[email] Sent OK id:", result.data?.id, "→", to);
    }
  } catch (err) {
    console.error("[email] Exception sending email:", err, "subject:", subject, "to:", to);
  }
}

// ── Templates ─────────────────────────────────────────────────────

// Escape user-controlled values before interpolating into email HTML to
// prevent stored XSS / HTML injection (org names, AI summaries, etc.).
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function base(content: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
<tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;">
<h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">StratiuMetrics</h1>
<p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Dashboard Empresarial Inteligente</p>
</td></tr>
<tr><td style="padding:32px;">${content}</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #f4f4f5;text-align:center;">
<p style="margin:0;font-size:12px;color:#a1a1aa;">© 2026 StratiuMetrics · Todos los derechos reservados</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

export function welcomeEmail(name: string, email: string) {
  return {
    subject: "Bienvenido a StratiuMetrics 🚀",
    html: base(`
      <h2 style="margin:0 0 8px;color:#18181b;font-size:20px;">¡Hola, ${esc(name)}!</h2>
      <p style="color:#71717a;font-size:15px;line-height:1.6;">Tu cuenta ha sido creada exitosamente con el correo <strong>${esc(email)}</strong>. Ya puedes acceder a tu dashboard empresarial.</p>
      <a href="${process.env.NEXTAUTH_URL}/dashboard/overview" style="display:inline-block;margin-top:20px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;">Ir al Dashboard</a>
      <p style="margin-top:24px;color:#a1a1aa;font-size:13px;">Si no creaste esta cuenta, puedes ignorar este correo.</p>
    `),
  };
}

export function reportEmail(name: string, reportTitle: string, summary: string, reportUrl: string) {
  return {
    subject: `📊 Tu reporte IA está listo: ${esc(reportTitle)}`,
    html: base(`
      <h2 style="margin:0 0 8px;color:#18181b;font-size:20px;">Tu reporte está listo</h2>
      <p style="color:#71717a;font-size:15px;line-height:1.6;">Hola <strong>${esc(name)}</strong>, tu reporte <em>${esc(reportTitle)}</em> fue generado por la IA.</p>
      <div style="background:#f4f4f5;border-radius:12px;padding:20px;margin:20px 0;">
        <p style="margin:0;color:#3f3f46;font-size:14px;line-height:1.7;">${esc(summary)}</p>
      </div>
      <a href="${reportUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;">Ver Reporte Completo</a>
    `),
  };
}

export function inviteEmail(inviterName: string, orgName: string, inviteUrl: string) {
  return {
    subject: `${esc(inviterName)} te invitó a StratiuMetrics`,
    html: base(`
      <h2 style="margin:0 0 8px;color:#18181b;font-size:20px;">Tienes una invitación</h2>
      <p style="color:#71717a;font-size:15px;line-height:1.6;"><strong>${esc(inviterName)}</strong> te invitó a unirte a <strong>${esc(orgName)}</strong> en StratiuMetrics, el dashboard empresarial inteligente.</p>
      <a href="${inviteUrl}" style="display:inline-block;margin-top:16px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;">Aceptar Invitación</a>
      <p style="margin-top:24px;color:#a1a1aa;font-size:13px;">Este enlace expira en 7 días.</p>
    `),
  };
}

export function billingEmail(name: string, event: "upgraded" | "canceled" | "payment_failed" | "trial_ending", planName?: string) {
  const content: Record<string, { title: string; body: string }> = {
    upgraded: {
      title: "Plan actualizado",
      body: `Tu plan fue actualizado a <strong>${esc(planName)}</strong>. Ya tienes acceso a todas las funciones de tu nuevo plan.`,
    },
    canceled: {
      title: "Suscripción cancelada",
      body: `Tu suscripción fue cancelada. Seguirás teniendo acceso hasta el final del período actual.`,
    },
    payment_failed: {
      title: "Pago fallido",
      body: `No pudimos procesar tu pago. Por favor actualiza tu método de pago para continuar usando StratiuMetrics.`,
    },
    trial_ending: {
      title: "Tu período de prueba termina pronto",
      body: `Tu prueba gratuita termina en 3 días. Actualiza tu plan para no perder el acceso.`,
    },
  };
  const { title, body } = content[event];
  return {
    subject: `StratiuMetrics: ${title}`,
    html: base(`
      <h2 style="margin:0 0 8px;color:#18181b;font-size:20px;">${title}</h2>
      <p style="color:#71717a;font-size:15px;line-height:1.6;">Hola <strong>${esc(name)}</strong>, ${body}</p>
      <a href="${process.env.NEXTAUTH_URL}/dashboard/billing" style="display:inline-block;margin-top:20px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;">Ver Suscripción</a>
    `),
  };
}

const fmtMoney = (v: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(v);

interface DigestRow { label: string; value: string; sub?: string }

/**
 * Periodic executive digest sent to the org owner (weekly / monthly).
 * `kpis` are headline numbers, `alerts` are anomaly messages.
 */
export function digestEmail(
  name: string,
  orgName: string,
  period: "semanal" | "mensual",
  kpis: DigestRow[],
  alerts: { message: string; severity: string }[],
) {
  const kpiHtml = kpis
    .map(
      (k) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#3f3f46;font-size:14px;">${esc(k.label)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;text-align:right;color:#18181b;font-size:15px;font-weight:700;">${esc(k.value)}${k.sub ? `<br><span style="font-size:11px;font-weight:400;color:#a1a1aa;">${esc(k.sub)}</span>` : ""}</td>
      </tr>`,
    )
    .join("");

  const alertHtml = alerts.length
    ? `<div style="margin-top:24px;"><h3 style="margin:0 0 8px;color:#18181b;font-size:15px;">⚠️ Alertas detectadas por la IA</h3>${alerts
        .map((a) => {
          const color = a.severity === "critical" ? "#dc2626" : a.severity === "warning" ? "#d97706" : "#2563eb";
          return `<p style="margin:6px 0;padding:10px 12px;background:#f4f4f5;border-left:3px solid ${color};border-radius:6px;color:#3f3f46;font-size:13px;line-height:1.5;">${esc(a.message)}</p>`;
        })
        .join("")}</div>`
    : `<p style="margin-top:20px;color:#16a34a;font-size:13px;">✓ Sin anomalías relevantes este período.</p>`;

  return {
    subject: `📊 Tu resumen ${esc(period)} — ${esc(orgName)}`,
    html: base(`
      <h2 style="margin:0 0 4px;color:#18181b;font-size:20px;">Resumen ${esc(period)}</h2>
      <p style="color:#71717a;font-size:14px;line-height:1.6;">Hola <strong>${esc(name)}</strong>, este es el estado de <strong>${esc(orgName)}</strong>.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">${kpiHtml}</table>
      ${alertHtml}
      <a href="${process.env.NEXTAUTH_URL}/dashboard/overview" style="display:inline-block;margin-top:24px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;">Abrir Dashboard</a>
    `),
  };
}

export { fmtMoney as fmtMoneyForEmail };
