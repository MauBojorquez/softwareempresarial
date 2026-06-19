import { NextResponse } from "next/server";
import { db } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Check = { name: string; status: "operational" | "degraded" | "down"; latencyMs?: number; note?: string };

// GET /api/status — public health check. Reports component status without
// exposing any secrets. Used by the /status page and external monitors.
export async function GET() {
  const checks: Check[] = [];

  // Database — real connectivity probe.
  const dbStart = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    const latency = Date.now() - dbStart;
    checks.push({
      name: "Base de datos",
      status: latency > 1500 ? "degraded" : "operational",
      latencyMs: latency,
    });
  } catch {
    checks.push({ name: "Base de datos", status: "down", note: "Sin conexión" });
  }

  // Dependent services — report whether they're configured. A missing key
  // means the feature is unavailable, not that the platform is down.
  const services: Array<{ name: string; env: string }> = [
    { name: "Autenticación", env: "NEXTAUTH_SECRET" },
    { name: "Pagos (Stripe)", env: "STRIPE_SECRET_KEY" },
    { name: "Correo (Resend)", env: "RESEND_API_KEY" },
    { name: "IA (Anthropic)", env: "ANTHROPIC_API_KEY" },
  ];
  for (const s of services) {
    checks.push({
      name: s.name,
      status: process.env[s.env] ? "operational" : "degraded",
      note: process.env[s.env] ? undefined : "No configurado",
    });
  }

  const overall: Check["status"] = checks.some((c) => c.status === "down")
    ? "down"
    : checks.some((c) => c.status === "degraded")
      ? "degraded"
      : "operational";

  return NextResponse.json(
    { status: overall, checks, timestamp: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
