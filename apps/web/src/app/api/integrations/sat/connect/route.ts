import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { ensureMembership } from "@/server/services/membership";
import {
  createFacturapiOrg,
  uploadFiel,
} from "@/server/services/sat/facturapi-service";

// Triggers a background sync after connect — fire-and-forget
async function triggerInitialSync(organizationId: string) {
  try {
    const { syncSatMetrics } = await import(
      "@/server/services/sat/sync-sat-metrics"
    );
    await syncSatMetrics(organizationId);
  } catch (err) {
    console.error("[SAT] Initial sync failed:", err);
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await ensureMembership(session.user.id);
  if (!membership) {
    return NextResponse.redirect(
      new URL("/login?error=session_expired", req.url),
    );
  }

  // Parse multipart form
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const rfc = (formData.get("rfc") as string | null)?.trim().toUpperCase();
  const cerFile = formData.get("cer") as File | null;
  const keyFile = formData.get("key") as File | null;
  const password = formData.get("password") as string | null;

  if (!rfc || !cerFile || !keyFile || !password) {
    return NextResponse.json(
      { error: "Missing required fields: rfc, cer, key, password" },
      { status: 400 },
    );
  }

  // Get organization name for Facturapi
  const org = await db.organization.findUnique({
    where: { id: membership.organizationId },
    select: { name: true },
  });

  try {
    // 1. Create Facturapi sub-organization
    const facturapiOrg = await createFacturapiOrg(org?.name ?? rfc);

    // 2. Upload FIEL/e.firma to Facturapi (files stay on their servers only)
    await uploadFiel(facturapiOrg.id, cerFile, keyFile, password, rfc);

    // 3. Upsert SatCredential
    await db.satCredential.upsert({
      where: { organizationId: membership.organizationId },
      create: {
        organizationId: membership.organizationId,
        rfc,
        facturapiOrgId: facturapiOrg.id,
        syncStatus: "pending",
      },
      update: {
        rfc,
        facturapiOrgId: facturapiOrg.id,
        syncStatus: "pending",
        lastError: null,
      },
    });

    // 4. Fire-and-forget initial sync
    void triggerInitialSync(membership.organizationId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[SAT] Connect error:", err);
    const message =
      err instanceof Error ? err.message : "Error al conectar con el SAT";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
