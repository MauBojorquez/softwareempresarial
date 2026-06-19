import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { pollSatDownloads } from "@/server/services/sat/sync-sat-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Distinct orgs that still have non-terminal download requests.
  const orgs = await db.satDownloadRequest.findMany({
    where: { status: { in: ["pending", "accepted", "finished"] } },
    select: { organizationId: true },
    distinct: ["organizationId"],
  });

  let processed = 0;
  for (const { organizationId } of orgs) {
    try {
      await pollSatDownloads(organizationId);
      processed++;
    } catch {
      // Continue with remaining orgs; per-org errors are recorded in their
      // credential status by pollSatDownloads.
    }
  }

  return NextResponse.json({ processed });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
