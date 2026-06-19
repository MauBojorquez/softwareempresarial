import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { ensureMembership } from "@/server/services/membership";
import { encrypt } from "@/lib/sat-crypto";
import { buildService } from "@/server/services/sat/nodecfdi-service";
import { startSatDownload } from "@/server/services/sat/sync-sat-metrics";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const membership = await ensureMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "session_expired" }, { status: 401 });
  }

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
      { error: "Faltan campos requeridos: rfc, cer, key, password" },
      { status: 400 },
    );
  }

  try {
    const cerBin = Buffer.from(await cerFile.arrayBuffer());
    const keyBin = Buffer.from(await keyFile.arrayBuffer());

    // Validate the e.firma against the package — throws if invalid.
    await buildService(cerBin, keyBin, password);

    // Encrypt at rest. Never store plaintext.
    const encryptedCer = encrypt(cerBin);
    const encryptedKey = encrypt(keyBin);
    const encryptedPassword = encrypt(password);

    await db.satCredential.upsert({
      where: { organizationId: membership.organizationId },
      create: {
        organizationId: membership.organizationId,
        rfc,
        encryptedCer,
        encryptedKey,
        encryptedPassword,
        syncStatus: "pending",
      },
      update: {
        rfc,
        encryptedCer,
        encryptedKey,
        encryptedPassword,
        syncStatus: "pending",
        lastError: null,
      },
    });

    // Kick off the SAT query (quick — seconds). Polling happens later via cron.
    await startSatDownload(membership.organizationId);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al conectar con el SAT";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
