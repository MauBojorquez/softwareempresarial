import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { currentMonthMX, shiftDate, shiftMonth, todayMX } from "@/lib/day";

async function fetchWithTimeout(url: string, ms = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const access = await requireAccess(req, "marketing");
  if (access instanceof NextResponse) return access;
  const membership = { organizationId: access.orgId };

  const integration = await db.integration.findFirst({
    where: { organizationId: membership.organizationId, type: "META_ADS", isActive: true },
  });

  if (!integration) {
    return NextResponse.json({ connected: false });
  }

  const selectedAccountId = req.nextUrl.searchParams.get("accountId");
  const accessToken = integration.accessToken;
  const metadata = integration.metadata as any;
  const adAccounts: { id: string; name: string }[] = metadata?.adAccounts || [];

  if (adAccounts.length === 0) {
    return NextResponse.json({ connected: true, current: emptyMetrics(), changes: {} });
  }

  const account = selectedAccountId
    ? adAccounts.find((a) => a.id === selectedAccountId) || adAccounts[0]
    : adAccounts[0];

  // Calendar days in the business (Mexico City) timezone, not UTC.
  const mesActual = currentMonthMX();
  const sinceCurrent = `${mesActual}-01`;
  const untilCurrent = todayMX();
  const sincePrev = `${shiftMonth(mesActual, -1)}-01`;
  const untilPrev = shiftDate(sinceCurrent, -1);

  try {
    const fields = "spend,impressions,clicks,ctr,cpc,cpm,reach";

    const [currentRes, previousRes] = await Promise.all([
      fetchWithTimeout(
        `https://graph.facebook.com/v21.0/${account.id}/insights?fields=${fields}&time_range={"since":"${sinceCurrent}","until":"${untilCurrent}"}&access_token=${accessToken}`
      ),
      fetchWithTimeout(
        `https://graph.facebook.com/v21.0/${account.id}/insights?fields=${fields}&time_range={"since":"${sincePrev}","until":"${untilPrev}"}&access_token=${accessToken}`
      ),
    ]);

    const currentData = currentRes.ok ? (await currentRes.json()).data?.[0] : null;
    const previousData = previousRes.ok ? (await previousRes.json()).data?.[0] : null;

    const parse = (d: any) => {
      if (!d) return emptyMetrics();
      return {
        spend: parseFloat(d.spend || "0"),
        impressions: parseInt(d.impressions || "0"),
        clicks: parseInt(d.clicks || "0"),
        ctr: parseFloat(d.ctr || "0"),
        cpc: parseFloat(d.cpc || "0"),
        cpm: parseFloat(d.cpm || "0"),
        reach: parseInt(d.reach || "0"),
        roas: 0,
      };
    };

    const current = parse(currentData);
    const previous = parse(previousData);

    const calcChange = (curr: number, prev: number) =>
      prev > 0 ? parseFloat((((curr - prev) / prev) * 100).toFixed(1)) : null;

    return NextResponse.json({
      connected: true,
      current,
      changes: {
        spend: calcChange(current.spend, previous.spend),
        clicks: calcChange(current.clicks, previous.clicks),
        ctr: calcChange(current.ctr, previous.ctr),
      },
    });
  } catch (err: any) {
    console.error("Meta marketing metrics error:", err);
    return NextResponse.json({ connected: true, current: emptyMetrics(), changes: {} });
  }
}

function emptyMetrics() {
  return { spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0, reach: 0, roas: 0 };
}
