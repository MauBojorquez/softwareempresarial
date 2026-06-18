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
  const accessToken = integration.accessToken;
  const metadata = integration.metadata as any;
  const adAccounts = metadata?.adAccounts || [];

  if (adAccounts.length === 0) {
    return NextResponse.json({ connected: true, campaigns: [], monthly: [], adAccounts: [] });
  }

  try {
    const accountId = adAccounts[0].id;

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
        tokenExpired: true,
        error: tokenError || "Tu token de Meta Ads expiró. Reconecta desde Integraciones.",
      });
    }

    const campaignsRes = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}/campaigns?` +
      `fields=id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,` +
      `insights.date_preset(this_month){spend,impressions,clicks,ctr,cpc,reach,actions,action_values}` +
      `&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE","PAUSED"]}]` +
      `&limit=50&access_token=${accessToken}`
    );

    let campaigns: any[] = [];
    let apiError = "";

    if (campaignsRes.ok) {
      const data = await campaignsRes.json();

      if (data.error) {
        apiError = data.error.message || "Error de API de Meta";
      } else {
        campaigns = (data.data || []).map((c: any) => {
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
          };
        });
      }
    } else {
      const errData = await campaignsRes.json().catch(() => null);
      apiError = errData?.error?.message || `Error ${campaignsRes.status} al obtener campañas`;
    }

    const now = new Date();
    const monthly: any[] = [];

    for (let i = 0; i < months; i++) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = i === 0 ? now : new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const since = start.toISOString().split("T")[0];
      const until = end.toISOString().split("T")[0];
      const monthName = start.toLocaleDateString("es-MX", { month: "short", year: "numeric" });

      try {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${accountId}/insights?` +
          `fields=spend,impressions,clicks,ctr,cpc,cpm,reach` +
          `&time_range={"since":"${since}","until":"${until}"}` +
          `&access_token=${accessToken}`
        );

        if (res.ok) {
          const data = await res.json();
          const d = data.data?.[0];

          monthly.push({
            month: monthName,
            spend: d ? parseFloat(d.spend || "0") : 0,
            impressions: d ? parseInt(d.impressions || "0") : 0,
            clicks: d ? parseInt(d.clicks || "0") : 0,
            ctr: d ? parseFloat(d.ctr || "0") : 0,
            cpc: d ? parseFloat(d.cpc || "0") : 0,
            reach: d ? parseInt(d.reach || "0") : 0,
            hasData: !!d,
          });
        } else {
          monthly.push({ month: monthName, spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, reach: 0, hasData: false });
        }
      } catch {
        monthly.push({ month: monthName, spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, reach: 0, hasData: false });
      }
    }

    return NextResponse.json({
      connected: true,
      campaigns,
      monthly: monthly.reverse(),
      activeCampaigns: campaigns.filter((c) => c.status === "ACTIVE").length,
      totalCampaigns: campaigns.length,
      accountId,
      accountName: adAccounts[0].name || accountId,
      error: apiError || undefined,
    });
  } catch (err: any) {
    console.error("Meta Ads fetch error:", err);
    return NextResponse.json({
      connected: true,
      campaigns: [],
      monthly: [],
      error: err.message || "Error al conectar con Meta Ads",
    });
  }
}
