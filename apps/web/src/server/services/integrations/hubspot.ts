import { db } from "@/server/db";

const HUBSPOT_BASE_URL = "https://api.hubapi.com";

export async function getHubSpotClient(organizationId: string) {
  const integration = await db.integration.findUnique({
    where: { organizationId_type: { organizationId, type: "HUBSPOT" } },
  });

  if (!integration || !integration.isActive) {
    throw new Error("HubSpot integration not found or inactive");
  }

  return { accessToken: integration.accessToken };
}

async function hubspotFetch(accessToken: string, path: string) {
  const response = await fetch(`${HUBSPOT_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) throw new Error(`HubSpot API error: ${response.status}`);
  return response.json();
}

export async function fetchDeals(organizationId: string) {
  const { accessToken } = await getHubSpotClient(organizationId);
  return hubspotFetch(accessToken, "/crm/v3/objects/deals?limit=100&properties=dealname,amount,dealstage,closedate");
}

export async function fetchContacts(organizationId: string) {
  const { accessToken } = await getHubSpotClient(organizationId);
  return hubspotFetch(accessToken, "/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,lifecyclestage");
}

export async function fetchPipeline(organizationId: string) {
  const { accessToken } = await getHubSpotClient(organizationId);
  return hubspotFetch(accessToken, "/crm/v3/pipelines/deals");
}

export async function syncSalesMetrics(organizationId: string) {
  const now = new Date();
  const deals = await fetchDeals(organizationId);
  const results = deals.results ?? [];

  const totalPipeline = results.reduce(
    (sum: number, deal: { properties?: { amount?: string } }) =>
      sum + parseFloat(deal.properties?.amount ?? "0"),
    0
  );

  const wonDeals = results.filter(
    (d: { properties?: { dealstage?: string } }) => d.properties?.dealstage === "closedwon"
  );
  const wonRevenue = wonDeals.reduce(
    (sum: number, deal: { properties?: { amount?: string } }) =>
      sum + parseFloat(deal.properties?.amount ?? "0"),
    0
  );

  const conversionRate = results.length > 0 ? (wonDeals.length / results.length) * 100 : 0;

  await db.metric.createMany({
    data: [
      { organizationId, category: "SALES", name: "pipeline_value", value: totalPipeline, period: now, source: "HUBSPOT" },
      { organizationId, category: "SALES", name: "won_revenue", value: wonRevenue, period: now, source: "HUBSPOT" },
      { organizationId, category: "SALES", name: "conversion_rate", value: conversionRate, unit: "%", period: now, source: "HUBSPOT" },
      { organizationId, category: "SALES", name: "total_deals", value: results.length, period: now, source: "HUBSPOT" },
    ],
  });
}
