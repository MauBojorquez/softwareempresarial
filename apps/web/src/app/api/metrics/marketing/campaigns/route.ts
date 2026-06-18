import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

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
    const tokenCheck = await fetch(
      `https://graph.facebook.com/v21.0/debug_token?input_token=${accessToken}&access_token=${accessToken}`
    );
    let tokenValid = true;
    let tokenError = "";
    if (tokenCheck.ok) {
      const tokenData = await tokenCheck.json();
      if (tokenData.data && !tokenData.data.is_valid) {
        tokenValid = false;
        tokenError = tokenData.data.error?.message || "Token expirado o inválido";
      }
    }

    if (!tokenValid) {
      return NextResponse.json({
        connected: true,
        campaigns: [],
        monthly: [],
        adAccounts,
        tokenExpired: true,
        error: tokenError || "Tu token de Meta Ads expiró. Reconecta desde Integraciones.",
      });
    }

    const accountsToFetch = selectedAccountId
      ? adAccounts.filter((a) => a.id === selectedAccountId)
      : adAccounts;

    if (accountsToFetch.length === 0) {
      return NextResponse.json({ connected: true, campaigns: [], monthly: [], adAccounts, error: "Cuenta no encontrada" });
    }

    let allCampaigns: any[] = [];
    let apiError = "";

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sinceCurrent = thisMonthStart.toISOString().split("T")[0];
    const untilCurrent = now.toISOString().split("T")[0];

    for (const account of accountsToFetch) {
      try {
        const campaignsRes = await fetch(
          `https://graph.facebook.com/v21.0/${account.id}/campaigns?` +
          `fields=id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,` +
          `insights.time_range({"since":"${sinceCurrent}","until":"${untilCurrent}"}){spend,impressions,clicks,ctr,cpc,reach,actions,action_values}` +
          `&limit=100&access_token=${accessToken}`
        );

        if (campaignsRes.ok) {
          const data = await campaignsRes.json();
          if (data.error) {
            apiError = data.error.message || "Error de API de Meta";
          } else {
            const mapped = (data.data || []).map((c: any) => {
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
            allCampaigns.push(...mapped);
          }
        } else {
          const errData = await campaignsRes.json().catch(() => null);
          apiError = errData?.error?.message || `Error ${campaignsRes.status}`;
        }
      } catch {
        // skip failed account
      }
    }

    allCampaigns.sort((a, b) => b.spend - a.spend);

    const monthly: any[] = [];

    for (let i = 0; i < months; i++) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = i === 0 ? now : new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const since = start.toISOString().split("T")[0];
      const until = end.toISOString().split("T")[0];
      const monthName = start.toLocaleDateString("es-MX", { month: "short", year: "numeric" });

      let monthSpend = 0, monthImpressions = 0, monthClicks = 0, monthReach = 0;
      let monthCtr = 0, monthCpc = 0, hasAnyData = false;

      for (const account of accountsToFetch) {
        try {
          const res = await fetch(
            `https://graph.facebook.com/v21.0/${account.id}/insights?` +
            `fields=spend,impressions,clicks,ctr,cpc,cpm,reach` +
            `&time_range={"since":"${since}","until":"${until}"}` +
            `&access_token=${accessToken}`
          );

          if (res.ok) {
            const data = await res.json();
            const d = data.data?.[0];
            if (d) {
              hasAnyData = true;
              monthSpend += parseFloat(d.spend || "0");
              monthImpressions += parseInt(d.impressions || "0");
              monthClicks += parseInt(d.clicks || "0");
              monthReach += parseInt(d.reach || "0");
            }
          }
        } catch {
          // skip
        }
      }

      if (hasAnyData && monthImpressions > 0) {
        monthCtr = (monthClicks / monthImpressions) * 100;
        monthCpc = monthClicks > 0 ? monthSpend / monthClicks : 0;
      }

      monthly.push({
        month: monthName,
        spend: monthSpend,
        impressions: monthImpressions,
        clicks: monthClicks,
        ctr: Math.round(monthCtr * 100) / 100,
        cpc: Math.round(monthCpc * 100) / 100,
        reach: monthReach,
        hasData: hasAnyData,
      });
    }

    const activeCampaigns = allCampaigns.filter((c) => c.status === "ACTIVE");

    return NextResponse.json({
      connected: true,
      campaigns: allCampaigns,
      monthly: monthly.reverse(),
      activeCampaigns: activeCampaigns.length,
      totalCampaigns: allCampaigns.length,
      adAccounts: adAccounts.map((a) => ({ id: a.id, name: a.name || a.id })),
      selectedAccountId: selectedAccountId || "all",
      error: apiError || undefined,
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
