import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { sendEmail } from "@/server/services/email";

// POST /api/webhooks/make — inbound webhook called by Make (formerly Integromat).
//
// Usage:
//   In Make, create an HTTP module (POST) pointing to:
//   https://<your-domain>/api/webhooks/make
//   with header  X-Make-Secret: <value of MAKE_WEBHOOK_SECRET env var>
//
// Supported events:
//   { event: "whatsapp.delivered", orgId, message, recipients: string[] }
//   { event: "digest.request", orgId }   → triggers an immediate digest email
//   { event: "alert.notify", orgId, metricName, value, threshold, condition }
//
// Make calls this after its own WhatsApp / messaging module so MetrixPro can
// log the delivery and optionally emit a notification to the user.
export async function POST(req: NextRequest) {
  const secret = process.env.MAKE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const incomingSecret = req.headers.get("x-make-secret");
  if (incomingSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event, orgId } = body;
  if (!event || !orgId || typeof orgId !== "string") {
    return NextResponse.json({ error: "event and orgId are required" }, { status: 400 });
  }

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, ownerId: true, owner: { select: { email: true, name: true } } },
  });
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  switch (event) {
    case "whatsapp.delivered": {
      // Make delivered a WhatsApp message — log an in-app notification so the
      // owner sees confirmation in the notification center.
      const message = typeof body.message === "string" ? body.message.slice(0, 300) : "Resumen enviado";
      await db.notification.create({
        data: {
          userId: org.ownerId,
          title: "📱 WhatsApp enviado",
          message: `Make entregó tu resumen por WhatsApp: ${message}`,
          type: "info",
        },
      }).catch(() => {});
      return NextResponse.json({ ok: true, logged: true });
    }

    case "digest.request": {
      // Make requests an immediate digest — generate and email it now.
      // Reuse the same digest logic the cron uses (inline here to avoid
      // importing the full cron handler).
      if (!org.owner?.email) return NextResponse.json({ ok: false, reason: "No owner email" });

      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const metrics = await db.metric.findMany({
        where: { organizationId: org.id, createdAt: { gte: since } },
        orderBy: { period: "desc" },
      });

      const byName: Record<string, number[]> = {};
      for (const m of metrics) {
        (byName[m.name] ??= []).push(m.value);
      }
      const kpis = Object.entries(byName)
        .slice(0, 6)
        .map(([label, vals]) => ({
          label,
          value: new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(vals[0] ?? 0),
        }));

      const { digestEmail } = await import("@/server/services/email");
      const { subject, html } = digestEmail(
        org.owner.name ?? "Equipo",
        org.name,
        "mensual",
        kpis,
        [],
      );
      await sendEmail(org.owner.email, subject, html);
      return NextResponse.json({ ok: true, sent: true });
    }

    case "alert.notify": {
      // Make detected an alert threshold crossing and wants MetrixPro to record
      // it as an in-app notification.
      const metricName = typeof body.metricName === "string" ? body.metricName : "métrica";
      const value = typeof body.value === "number" ? body.value : 0;
      await db.notification.create({
        data: {
          userId: org.ownerId,
          title: `⚠️ Alerta: ${metricName}`,
          message: `Make reporta que ${metricName} alcanzó ${value}. Revisa tu dashboard.`,
          type: "warning",
        },
      }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: `Unknown event: ${event}` }, { status: 400 });
  }
}
