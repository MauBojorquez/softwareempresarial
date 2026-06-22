import { NextRequest, NextResponse } from "next/server";
import { refreshAllSatCredentials } from "@/server/services/sat/sync-sat-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// SAT verify/download/parse can be slow; give the cron room to finish.
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Vercel cron invocations carry the Authorization: Bearer <CRON_SECRET>
  // header automatically when CRON_SECRET is configured in the project env.
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Polls in-flight requests AND kicks off fresh rolling-window downloads for
  // any connected org whose data is stale, so finanzas stays up to date.
  const results = await refreshAllSatCredentials();

  return NextResponse.json({ processed: results.length, results });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
