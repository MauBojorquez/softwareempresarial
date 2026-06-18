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

  const months = parseInt(req.nextUrl.searchParams.get("months") || "3");
  const accessToken = integration.accessToken;
  const metadata = integration.metadata as any;
  const adAccounts = metadata?.adAccounts || [];

  if (adAccounts.length === 0) {
    return NextResponse.json({ connected: true, campaigns: [], monthly: [] });
  }

  try {
    const accountId = adAccounts[0].id;

    const campaignsRes = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}/campaigns?` +
      `fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,insights.date_preset(this_month){spend,impressions,clicks,ctr,cpc,reach,actions,action_values}` +
      `&limit=25&access_token=${accessToken}`
    );

    let campaigns: any[] = [];
    if (campaignsRes.ok) {
      const data = await campaignsRes.json();
      campaigns = (data.data || []).map((c: any) => {
        const insights = c.insights?.data?.[0] || {};
        const conversions = (insights.actions || [])
          .filter((a: any) => ["purchase", "lead", "complete_registration"].some((t) => a.action_type?.includes(t)))
          .reduce((sum: number, a: any) => sum + parseInt(a.value || "0"), 0);

        return {
          id: c.id,
          name: c.name,
          status: c.status,
          objective: c.objective,
          spend: parseFloat(insights.spend || "0"),
          impressions: parseInt(insights.impressions || "0"),
          clicks: parseInt(insights.clicks || "0"),
          ctr: parseFloat(insights.ctr || "0"),
          cpc: parseFloat(insights.cpc || "0"),
          reach: parseInt(insights.reach || "0"),
          conversions,
        };
      });
    }

    const now = new Date();
    const monthly: any[] = [];

    for (let i = 0; i < months; i++) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = i === 0 ? now : new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const since = start.toISOString().split("T")[0];
      const until = end.toISOString().split("T")[0];

      const res = await fetch(
        `https://graph.facebook.com/v21.0/${accountId}/insights?` +
        `fields=spend,impressions,clicks,ctr,cpc,cpm,reach,actions,action_values` +
        `&time_range={"since":"${since}","until":"${until}"}` +
        `&access_token=${accessToken}`
      );

      if (res.ok) {
        const data = await res.json();
        const d = data.data?.[0] || {};
        const monthName = start.toLocaleDateString("es-MX", { month: "short", year: "numeric" });

        monthly.push({
          month: monthName,
          spend: parseFloat(d.spend || "0"),
          impressions: parseInt(d.impressions || "0"),
          clicks: parseInt(d.clicks || "0"),
          ctr: parseFloat(d.ctr || "0"),
          cpc: parseFloat(d.cpc || "0"),
          reach: parseInt(d.reach || "0"),
        });
      }
    }

    return NextResponse.json({
      connected: true,
      campaigns,
      monthly: monthly.reverse(),
      activeCampaigns: campaigns.filter((c) => c.status === "ACTIVE").length,
      totalCampaigns: campaigns.length,
    });
  } catch {
    return NextResponse.json({ connected: true, campaigns: [], monthly: [], error: "fetch_failed" });
  }
}
