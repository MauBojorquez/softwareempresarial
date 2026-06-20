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
    throw new Error("Meta Ads integration not found or inactive");
  }

  const metadata = integration.metadata as any;
  const adAccounts = metadata?.adAccounts || [];

  if (adAccounts.length === 0) {
    throw new Error("No ad accounts found");
  }

  // Use a SINGLE account — the one the user selected in the dashboard, or the
  // first one as a default. Summing every account inflated the totals.
  const selectedId = metadata?.selectedAccountId;
  const account =
    (selectedId && adAccounts.find((a: any) => a.id === selectedId)) || adAccounts[0];

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const allMetrics: any[] = [];

  {
    const accountId = account.id;

    // Current month insights
    const currentInsights = await fetchAccountInsights(
      accountId,
      integration.accessToken,
      formatDate(firstOfMonth),
      formatDate(now)
    );

    // Previous month insights
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const previousInsights = await fetchAccountInsights(
      accountId,
      integration.accessToken,
      formatDate(lastMonth),
      formatDate(prevMonthEnd)
    );

    if (currentInsights) {
      allMetrics.push(
        { organizationId, category: "MARKETING" as const, name: "meta_spend", value: parseFloat(currentInsights.spend || "0"), unit: account.currency || "MXN", period: firstOfMonth, source: "META_ADS" as const },
        { organizationId, category: "MARKETING" as const, name: "meta_impressions", value: parseInt(currentInsights.impressions || "0"), period: firstOfMonth, source: "META_ADS" as const },
        { organizationId, category: "MARKETING" as const, name: "meta_clicks", value: parseInt(currentInsights.clicks || "0"), period: firstOfMonth, source: "META_ADS" as const },
        { organizationId, category: "MARKETING" as const, name: "meta_ctr", value: parseFloat(currentInsights.ctr || "0"), unit: "%", period: firstOfMonth, source: "META_ADS" as const },
        { organizationId, category: "MARKETING" as const, name: "meta_cpc", value: parseFloat(currentInsights.cpc || "0"), unit: account.currency || "MXN", period: firstOfMonth, source: "META_ADS" as const },
        { organizationId, category: "MARKETING" as const, name: "meta_cpm", value: parseFloat(currentInsights.cpm || "0"), unit: account.currency || "MXN", period: firstOfMonth, source: "META_ADS" as const },
        { organizationId, category: "MARKETING" as const, name: "meta_reach", value: parseInt(currentInsights.reach || "0"), period: firstOfMonth, source: "META_ADS" as const },
        { organizationId, category: "SALES" as const, name: "meta_conversions", value: countConversions(currentInsights), period: firstOfMonth, source: "META_ADS" as const },
        { organizationId, category: "SALES" as const, name: "meta_roas", value: calculateROAS(currentInsights), period: firstOfMonth, source: "META_ADS" as const }
      );
    }

    if (previousInsights) {
      allMetrics.push(
        { organizationId, category: "MARKETING" as const, name: "meta_spend", value: parseFloat(previousInsights.spend || "0"), unit: account.currency || "MXN", period: lastMonth, source: "META_ADS" as const },
        { organizationId, category: "MARKETING" as const, name: "meta_impressions", value: parseInt(previousInsights.impressions || "0"), period: lastMonth, source: "META_ADS" as const },
        { organizationId, category: "MARKETING" as const, name: "meta_clicks", value: parseInt(previousInsights.clicks || "0"), period: lastMonth, source: "META_ADS" as const },
        { organizationId, category: "MARKETING" as const, name: "meta_ctr", value: parseFloat(previousInsights.ctr || "0"), unit: "%", period: lastMonth, source: "META_ADS" as const },
        { organizationId, category: "MARKETING" as const, name: "meta_cpc", value: parseFloat(previousInsights.cpc || "0"), unit: account.currency || "MXN", period: lastMonth, source: "META_ADS" as const },
        { organizationId, category: "MARKETING" as const, name: "meta_cpm", value: parseFloat(previousInsights.cpm || "0"), unit: account.currency || "MXN", period: lastMonth, source: "META_ADS" as const },
        { organizationId, category: "MARKETING" as const, name: "meta_reach", value: parseInt(previousInsights.reach || "0"), period: lastMonth, source: "META_ADS" as const },
        { organizationId, category: "SALES" as const, name: "meta_conversions", value: countConversions(previousInsights), period: lastMonth, source: "META_ADS" as const },
        { organizationId, category: "MARKETING" as const, name: "meta_roas", value: calculateROAS(previousInsights), period: lastMonth, source: "META_ADS" as const }
      );
    }
  }

  // Replace old META_ADS metrics atomically so a crash mid-way can't leave
  // the org with deleted-but-not-replaced metrics.
  await db.$transaction(async (tx) => {
    await tx.metric.deleteMany({ where: { organizationId, source: "META_ADS" } });
    if (allMetrics.length > 0) {
      await tx.metric.createMany({ data: allMetrics });
    }
  });

  return allMetrics.length;
}

async function fetchAccountInsights(
  accountId: string,
  accessToken: string,
  since: string,
  until: string
) {
  try {
    const fields = "spend,impressions,clicks,ctr,cpc,cpm,reach,actions,action_values";
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}/insights?fields=${fields}&time_range={"since":"${since}","until":"${until}"}&access_token=${accessToken}`
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.data?.[0] || null;
  } catch {
    return null;
  }
}

function countConversions(insights: any): number {
  if (!insights?.actions) return 0;
  const conversionActions = new Set([
    "purchase", "lead", "complete_registration",
    "offsite_conversion.fb_pixel_purchase",
    "offsite_conversion.fb_pixel_lead",
    "offsite_conversion.fb_pixel_complete_registration",
  ]);
  return insights.actions
    .filter((a: any) => conversionActions.has(a.action_type))
    .reduce((sum: number, a: any) => sum + parseInt(a.value || "0"), 0);
}

function calculateROAS(insights: any): number {
  if (!insights?.action_values || !insights?.spend) return 0;
  const purchaseValue = insights.action_values
    .filter((a: any) => a.action_type === "purchase")
    .reduce((sum: number, a: any) => sum + parseFloat(a.value || "0"), 0);
  const spend = parseFloat(insights.spend || "0");
  return spend > 0 ? parseFloat((purchaseValue / spend).toFixed(2)) : 0;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}
