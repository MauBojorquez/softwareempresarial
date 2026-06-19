import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { rateLimit } from "@/lib/rate-limit";
import { detectAnomalies } from "@/server/services/metrics/insights";

// GET /api/v1/digest — returns a ready-to-send business summary for the org
// tied to the API key. Designed for Make (Integromat) → WhatsApp delivery:
// just drop `{{body.text}}` into the WhatsApp module.
//
// Auth: Authorization: Bearer <api-key>
// Optional: ?format=text|json (default returns both)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }
  const key = authHeader.slice(7);

  const rl = rateLimit(`api-v1:${key}`, 120, 60_000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const apiKey = await db.apiKey.findUnique({ where: { key } });
  if (!apiKey || !apiKey.isActive) {
    return NextResponse.json({ error: "Invalid or inactive API key" }, { status: 401 });
  }
  await db.apiKey.update({ where: { id: apiKey.id }, data: { lastUsed: new Date() } }).catch(() => {});

  const org = await db.organization.findUnique({
    where: { id: apiKey.organizationId },
    select: { name: true },
  });

  // Latest value per metric name (last 60 days).
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const metrics = await db.metric.findMany({
    where: { organizationId: apiKey.organizationId, period: { gte: since }, name: { not: { startsWith: "META_" } } },
    orderBy: { period: "desc" },
  });

  const seen = new Set<string>();
  const latest: { name: string; value: number; unit: string | null }[] = [];
  for (const m of metrics) {
    if (seen.has(m.name)) continue;
    seen.add(m.name);
    latest.push({ name: m.name, value: m.value, unit: m.unit });
  }

  const fmt = (v: number, unit: string | null) =>
    unit === "MXN"
      ? new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(v)
      : `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(v)}${unit ? " " + unit : ""}`;

  const kpis = latest.slice(0, 8).map((m) => ({ label: m.name, value: fmt(m.value, m.unit) }));

  let anomalies: { metric: string; message: string; severity: string }[] = [];
  try {
    const detected = await detectAnomalies(apiKey.organizationId);
    anomalies = detected
      .filter((a) => a.severity === "critical" || a.severity === "warning")
      .slice(0, 5)
      .map((a) => ({ metric: a.metric, message: a.message, severity: a.severity }));
  } catch {
    // anomalies are best-effort
  }

  // Build the WhatsApp-friendly plain text message.
  const today = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  const lines: string[] = [];
  lines.push(`📊 *${org?.name ?? "Tu empresa"}* — Resumen`);
  lines.push(`🗓️ ${today}`);
  lines.push("");
  if (kpis.length) {
    lines.push("*Indicadores clave:*");
    for (const k of kpis) lines.push(`• ${k.label}: ${k.value}`);
  } else {
    lines.push("Aún no hay métricas registradas este período.");
  }
  if (anomalies.length) {
    lines.push("");
    lines.push("⚠️ *Alertas:*");
    for (const a of anomalies) lines.push(`• ${a.message}`);
  }
  lines.push("");
  lines.push("Abre tu dashboard para ver el detalle.");

  const text = lines.join("\n");

  // Recipients: org members who opted in to each channel. Make iterates over
  // these arrays and sends the digest to every phone / email.
  const members = await db.membership.findMany({
    where: { organizationId: apiKey.organizationId },
    select: { user: { select: { name: true, email: true, phone: true, notifyEmail: true, notifyWhatsapp: true } } },
  });

  const whatsapp: { name: string; phone: string }[] = [];
  const email: { name: string; email: string }[] = [];
  for (const m of members) {
    const u = m.user;
    if (!u) continue;
    if (u.notifyWhatsapp && u.phone) whatsapp.push({ name: u.name ?? "", phone: u.phone });
    if (u.notifyEmail && u.email) email.push({ name: u.name ?? "", email: u.email });
  }

  const format = req.nextUrl.searchParams.get("format");
  if (format === "text") {
    return new NextResponse(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  return NextResponse.json({
    organization: org?.name ?? null,
    date: today,
    kpis,
    alerts: anomalies,
    text,
    recipients: { whatsapp, email },
  });
}
