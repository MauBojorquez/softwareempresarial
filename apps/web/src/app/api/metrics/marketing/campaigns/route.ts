import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
  });

  if (!membership) {
    return NextResponse.json({ error: "No organization" }, { status: 404 });
  }

  const integration = await db.integration.findFirst({
    where: { organizationId: membership.organizationId, type: "META_ADS", isActive: true },
  });

  if (!integration) {
    return NextResponse.json({ connected: false });
  }

  const months = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("months") || "6"), 1), 12);
  const selectedAccountId = req.nextUrl.searchParams.get("accountId");
  const accessToken = integration.accessToken;
  const metadata = integration.metadata as any;
  const adAccounts: { id: string; name: string }[] = metadata?.adAccounts || [];

  if (adAccounts.length === 0) {
    return NextResponse.json({ connected: true, campaigns: [], monthly: [], adAccounts: [] });
  }

  try {
    const tokenCheck = await fetchWithTimeout(
      `https://graph.facebook.com/v21.0/debug_token?input_token=${accessToken}&access_token=${accessToken}`
    );
    if (tokenCheck.ok) {
      const tokenData = await tokenCheck.json();
      if (tokenData.data && !tokenData.data.is_valid) {
        return NextResponse.json({
          connected: true,
          campaigns: [],
          monthly: [],
          adAccounts,
          tokenExpired: true,
          error: tokenData.data.error?.message || "Tu token de Meta Ads expiró. Reconecta desde Integraciones.",
        });
      }
    }

    const accountsToFetch = selectedAccountId
      ? adAccounts.filter((a) => a.id === selectedAccountId)
      : adAccounts;

    if (accountsToFetch.length === 0) {
      return NextResponse.json({ connected: true, campaigns: [], monthly: [], adAccounts, error: "Cuenta no encontrada" });
    }

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sinceCurrent = thisMonthStart.toISOString().split("T")[0];
    const untilCurrent = now.toISOString().split("T")[0];

    // Fetch campaigns from all accounts in parallel
    const campaignResults = await Promise.allSettled(
      accountsToFetch.map(async (account) => {
        const res = await fetchWithTimeout(
          `https://graph.facebook.com/v21.0/${account.id}/campaigns?` +
          `fields=id,name,status,effective_status,objective,` +
          `insights.time_range({"since":"${sinceCurrent}","until":"${untilCurrent}"}){spend,impressions,clicks,ctr,cpc,reach,actions}` +
          `&limit=100&access_token=${accessToken}`
        );
        if (!res.ok) return [];
        const data = await res.json();
        if (data.error) return [];
        return (data.data || []).map((c: any) => {
          const insights = c.insights?.data?.[0] || {};
          const conversions = Array.isArray(insights.actions)
            ? insights.actions
                .filter((a: any) => ["purchase", "lead", "complete_registration"].some((t) => a.action_type?.includes(t)))
                .reduce((sum: number, a: any) => sum + parseInt(a.value || "0"), 0)
            : 0;
          return {
            id: c.id,
            name: c.name,
            status: c.effective_status || c.status,
            objective: c.objective,
            spend: parseFloat(insights.spend || "0"),
            impressions: parseInt(insights.impressions || "0"),
            clicks: parseInt(insights.clicks || "0"),
            ctr: parseFloat(insights.ctr || "0"),
            cpc: parseFloat(insights.cpc || "0"),
            reach: parseInt(insights.reach || "0"),
            conversions,
            accountId: account.id,
            accountName: account.name || account.id,
          };
        });
      })
    );

    const allCampaigns = campaignResults
      .filter((r): r is PromiseFulfilledResult<any[]> => r.status === "fulfilled")
      .flatMap((r) => r.value)
      .sort((a, b) => b.spend - a.spend);

    // Build month ranges
    const monthRanges = Array.from({ length: months }, (_, i) => {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = i === 0 ? now : new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      return {
        since: start.toISOString().split("T")[0]!,
        until: end.toISOString().split("T")[0]!,
        monthName: start.toLocaleDateString("es-MX", { month: "short", year: "numeric" }),
      };
    });

    // Fetch all monthly insights in parallel (one call per account × month)
    const monthlyResults = await Promise.allSettled(
      monthRanges.map(async (range) => {
        const accountFetches = await Promise.allSettled(
          accountsToFetch.map(async (account) => {
            const res = await fetchWithTimeout(
              `https://graph.facebook.com/v21.0/${account.id}/insights?` +
              `fields=spend,impressions,clicks,reach` +
              `&time_range={"since":"${range.since}","until":"${range.until}"}` +
              `&access_token=${accessToken}`
            );
            if (!res.ok) return null;
            const data = await res.json();
            return data.data?.[0] || null;
          })
        );

        let spend = 0, impressions = 0, clicks = 0, reach = 0, hasData = false;
        for (const r of accountFetches) {
          if (r.status === "fulfilled" && r.value) {
            hasData = true;
            spend += parseFloat(r.value.spend || "0");
            impressions += parseInt(r.value.impressions || "0");
            clicks += parseInt(r.value.clicks || "0");
            reach += parseInt(r.value.reach || "0");
          }
        }

        return {
          month: range.monthName,
          spend,
          impressions,
          clicks,
          ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
          cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
          reach,
          hasData,
        };
      })
    );

    const monthly = monthlyResults
      .map((r) => r.status === "fulfilled" ? r.value : { month: "", spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, reach: 0, hasData: false })
      .reverse();

    return NextResponse.json({
      connected: true,
      campaigns: allCampaigns,
      monthly,
      activeCampaigns: allCampaigns.filter((c) => c.status === "ACTIVE").length,
      totalCampaigns: allCampaigns.length,
      adAccounts: adAccounts.map((a) => ({ id: a.id, name: a.name || a.id })),
      selectedAccountId: selectedAccountId || "all",
    });
  } catch (err: any) {
    console.error("Meta Ads fetch error:", err);
    return NextResponse.json({
      connected: true,
      campaigns: [],
      monthly: [],
      adAccounts,
      error: err.message || "Error al conectar con Meta Ads",
    });
  }
}
