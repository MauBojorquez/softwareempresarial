import { NextResponse } from "next/server";
import { db } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Check = { name: string; status: "operational" | "degraded" | "down"; latencyMs?: number; note?: string };
type Body = { status: Check["status"]; checks: Check[]; timestamp: string };

// In-memory cache so a public, uncached endpoint can't hammer the DB with a
// `SELECT 1` on every request (cheap DoS amplifier otherwise).
let cache: { body: Body; at: number } | null = null;
const CACHE_MS = 15_000;

// GET /api/status — public health check. Reports component status without
// exposing any secrets. Used by the /status page and external monitors.
export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return NextResponse.json(cache.body, { headers: { "Cache-Control": "public, max-age=15" } });
  }

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

  // Dependent services — only reported as operational/degraded based on
  // whether they're configured. We deliberately avoid exposing *which*
  // specific key is missing as a generic "Sin servicio" to limit recon.
  const services: Array<{ name: string; env: string }> = [
    { name: "Autenticación", env: "NEXTAUTH_SECRET" },
    { name: "Pagos", env: "STRIPE_SECRET_KEY" },
    { name: "Correo", env: "RESEND_API_KEY" },
    { name: "Reportes IA", env: "ANTHROPIC_API_KEY" },
  ];
  for (const s of services) {
    const ok = Boolean(process.env[s.env]);
    checks.push({ name: s.name, status: ok ? "operational" : "degraded", note: ok ? undefined : "Sin servicio" });
  }

  const overall: Check["status"] = checks.some((c) => c.status === "down")
    ? "down"
    : checks.some((c) => c.status === "degraded")
      ? "degraded"
      : "operational";

  const body: Body = { status: overall, checks, timestamp: new Date().toISOString() };
  cache = { body, at: Date.now() };

  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=15" } });
}
