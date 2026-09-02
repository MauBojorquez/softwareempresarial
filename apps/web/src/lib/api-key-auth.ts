import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { rateLimit } from "@/lib/rate-limit";

export type ApiKeyAuth = { keyId: string; organizationId: string };

/**
 * Shared API-key authentication for public ingestion endpoints (metrics, Meta
 * leads, …). Expects `Authorization: Bearer <key>`, rate-limits per key,
 * verifies the key is active, stamps lastUsed, and returns the org it belongs to.
 *
 * On failure returns a NextResponse (401/429) — the caller must return it as-is.
 */
export async function authenticateApiKey(
  req: NextRequest,
  opts?: { bucket?: string; limit?: number; windowMs?: number },
): Promise<ApiKeyAuth | NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Falta el API key. Usa el header Authorization: Bearer <key>." },
      { status: 401 },
    );
  }

  const key = authHeader.slice(7).trim();
  if (!key) {
    return NextResponse.json({ error: "El API key está vacío." }, { status: 401 });
  }

  const bucket = opts?.bucket ?? "api";
  const rl = rateLimit(`${bucket}:${key}`, opts?.limit ?? 120, opts?.windowMs ?? 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Rate limit excedido. Intenta de nuevo en un momento." },
      { status: 429 },
    );
  }

  const apiKey = await db.apiKey.findUnique({ where: { key } });
  if (!apiKey || !apiKey.isActive) {
    return NextResponse.json({ error: "API key inválido o inactivo." }, { status: 401 });
  }

  await db.apiKey.update({ where: { id: apiKey.id }, data: { lastUsed: new Date() } });

  return { keyId: apiKey.id, organizationId: apiKey.organizationId };
}
