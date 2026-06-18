import { db } from "@/server/db";

export async function syncMetaAdsMetrics(organizationId: string) {
  const integration = await db.integration.findUnique({
    where: {
      organizationId_type: {
        organizationId,
        type: "META_ADS",
      },
    },
  });

  if (!integration || !integration.isActive) {
    throw new Error("Meta Ads not connected");
  }

  const metadata = integration.metadata as any;
  const adAccounts = metadata?.adAccounts || [];

  if (adAccounts.length === 0) {
    throw new Error("No ad accounts found");
  }

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const today = now.toISOString().split("T")[0];
  const monthStart = firstOfMonth.toISOString().split("T")[0];

  const allMetrics: any[] = [];

  for (const account of adAccounts) {
    const accountId = account.id;

    // Fetch account-level insights for current month
    const insightsUrl =
      `https://graph.facebook.com/v21.0/${accountId}/insights?` +
      `fields=spend,impressions,clicks,cpc,cpm,ctr,reach,frequency,actions,cost_per_action_type,purchase_roas` +
      `&time_range={"since":"${monthStart}","until":"${today}"}` +
      `&access_token=${integration.accessToken}`;

    const insightsRes = await fetch(insightsUrl);
    if (!insightsRes.ok) continue;

    const insightsData = await insightsRes.json();
    const insights = insightsData.data?.[0];
    if (!insights) continue;

    const spend = parseFloat(insights.spend || "0");
    const impressions = parseInt(insights.impressions || "0");
    const clicks = parseInt(insights.clicks || "0");
    const cpc = parseFloat(insights.cpc || "0");
    const cpm = parseFloat(insights.cpm || "0");
    const ctr = parseFloat(insights.ctr || "0");
    const reach = parseInt(insights.reach || "0");

    // Extract conversions (leads, purchases)
    const actions = insights.actions || [];
    const leads = actions.find((a: any) => a.action_type === "lead")?.value || 0;
    const purchases = actions.find((a: any) => a.action_type === "purchase")?.value || 0;
    const linkClicks = actions.find((a: any) => a.action_type === "link_click")?.value || clicks;

    // Extract cost per action
    const costPerAction = insights.cost_per_action_type || [];
    const costPerLead = costPerAction.find((a: any) => a.action_type === "lead")?.value || 0;

    // ROAS
    const roas = insights.purchase_roas?.[0]?.value || 0;

    allMetrics.push(
      { name: "ad_spend", value: spend, unit: account.currency || "MXN", category: "MARKETING" as const },
      { name: "impressions", value: impressions, category: "MARKETING" as const },
      { name: "clicks", value: parseInt(String(linkClicks)), category: "MARKETING" as const },
      { name: "cpc", value: cpc, unit: account.currency || "MXN", category: "MARKETING" as const },
      { name: "cpm", value: cpm, unit: account.currency || "MXN", category: "MARKETING" as const },
      { name: "ctr", value: ctr, unit: "%", category: "MARKETING" as const },
      { name: "reach", value: reach, category: "MARKETING" as const },
      { name: "ad_leads", value: parseInt(String(leads)), category: "MARKETING" as const },
      { name: "ad_purchases", value: parseInt(String(purchases)), category: "SALES" as const },
      { name: "cost_per_lead", value: parseFloat(String(costPerLead)), unit: account.currency || "MXN", category: "MARKETING" as const },
      { name: "roas", value: parseFloat(String(roas)), unit: "x", category: "MARKETING" as const }
    );

    // Fetch campaign-level data
    const campaignsUrl =
      `https://graph.facebook.com/v21.0/${accountId}/campaigns?` +
      `fields=name,status,insights.time_range({"since":"${monthStart}","until":"${today}"}){spend,impressions,clicks,actions}` +
      `&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE"]}]` +
      `&limit=25` +
      `&access_token=${integration.accessToken}`;

    const campaignsRes = await fetch(campaignsUrl);
    if (campaignsRes.ok) {
      const campaignsData = await campaignsRes.json();
      const activeCampaigns = campaignsData.data?.length || 0;
      allMetrics.push({
        name: "active_campaigns",
        value: activeCampaigns,
        category: "MARKETING" as const,
      });
    }
  }

  // Delete old Meta Ads metrics for this month and insert new ones
  await db.metric.deleteMany({
    where: {
      organizationId,
      source: "META_ADS",
      period: firstOfMonth,
    },
  });

  if (allMetrics.length > 0) {
    await db.metric.createMany({
      data: allMetrics.map((m) => ({
        organizationId,
        category: m.category,
        name: m.name,
        value: m.value,
        unit: m.unit,
        period: firstOfMonth,
        source: "META_ADS" as const,
      })),
    });
  }

  return { metricsCount: allMetrics.length };
}
