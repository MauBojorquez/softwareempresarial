import { db } from "@/server/db";
import { ensureValidToken } from "./token-refresh";

const HUBSPOT_BASE_URL = "https://api.hubapi.com";

export async function getHubSpotClient(organizationId: string) {
  const integration = await db.integration.findUnique({
    where: { organizationId_type: { organizationId, type: "HUBSPOT" } },
  });

  if (!integration || !integration.isActive) {
    throw new Error("HubSpot integration not found or inactive");
  }

  const accessToken = await ensureValidToken(organizationId, "HUBSPOT");

  return { accessToken };
}

async function hsFetch(accessToken: string, path: string) {
  const response = await fetch(`${HUBSPOT_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) throw new Error(`HubSpot API error: ${response.status}`);
  return response.json();
}

async function fetchAllPages(accessToken: string, basePath: string, limit = 100): Promise<any[]> {
  const results: any[] = [];
  let after: string | undefined;
  for (let page = 0; page < 100; page++) {
    const url = `${basePath}&limit=${limit}${after ? `&after=${after}` : ""}`;
    const data = await hsFetch(accessToken, url);
    results.push(...(data.results ?? []));
    after = data.paging?.next?.after;
    if (!after) break;
  }
  return results;
}

const STAGE_LABELS: Record<string, string> = {
  subscriber: "Suscriptor",
  lead: "Lead",
  marketingqualifiedlead: "MQL",
  salesqualifiedlead: "SQL",
  opportunity: "Oportunidad",
  customer: "Cliente",
  evangelist: "Evangelista",
  other: "Otro",
};

// Kept for backwards compat (unused internally now)
export async function fetchDeals(organizationId: string) {
  const { accessToken } = await getHubSpotClient(organizationId);
  return hsFetch(accessToken, "/crm/v3/objects/deals?limit=100&properties=dealname,amount,dealstage,closedate");
}

export async function fetchContacts(organizationId: string) {
  const { accessToken } = await getHubSpotClient(organizationId);
  return hsFetch(accessToken, "/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,lifecyclestage");
}

export async function fetchPipeline(organizationId: string) {
  const { accessToken } = await getHubSpotClient(organizationId);
  return hsFetch(accessToken, "/crm/v3/pipelines/deals");
}

/**
 * Full sync: fetches all pages from HubSpot, aggregates results, and saves:
 *   1. Summary metrics rows (pipeline_value, won_revenue, etc.)
 *   2. Full snapshot in integration.metadata so the dashboard can read
 *      instantly without hitting HubSpot on every page load.
 */
export async function syncSalesMetrics(organizationId: string) {
  const now = new Date();
  const { accessToken } = await getHubSpotClient(organizationId);

  const [contacts, deals, pipelinesData] = await Promise.all([
    fetchAllPages(accessToken, "/crm/v3/objects/contacts?properties=lifecyclestage,createdate"),
    fetchAllPages(accessToken, "/crm/v3/objects/deals?properties=dealname,amount,dealstage,closedate,pipeline"),
    hsFetch(accessToken, "/crm/v3/pipelines/deals"),
  ]);

  // Build stage id→label + closed-won/lost sets from pipeline definitions
  const stageLabel: Record<string, string> = {};
  const closedWonStages = new Set<string>();
  const closedLostStages = new Set<string>();
  for (const pipe of pipelinesData.results ?? []) {
    for (const s of pipe.stages ?? []) {
      stageLabel[s.id] = s.label;
      if (s.metadata?.probability === "1.0") closedWonStages.add(s.id);
      if (s.metadata?.probability === "0.0") closedLostStages.add(s.id);
      if (s.id === "closedwon") closedWonStages.add(s.id);
      if (s.id === "closedlost") closedLostStages.add(s.id);
    }
  }

  // Contacts by lifecycle stage
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime();
  const stageCount: Record<string, number> = {};
  let newThisMonth = 0;
  for (const c of contacts) {
    const stage = c.properties?.lifecyclestage ?? "other";
    stageCount[stage] = (stageCount[stage] ?? 0) + 1;
    if (new Date(c.properties?.createdate ?? 0).getTime() >= monthStart) newThisMonth++;
  }
  const byStage = Object.entries(stageCount)
    .sort((a, b) => b[1] - a[1])
    .map(([stage, count]) => ({
      stage,
      label: STAGE_LABELS[stage] ?? stage.charAt(0).toUpperCase() + stage.slice(1),
      count,
    }));

  // Deals by pipeline stage
  const dealsByStage: Record<string, { count: number; amount: number }> = {};
  let cwCount = 0, cwAmount = 0, clCount = 0;
  for (const d of deals) {
    const stage = d.properties?.dealstage ?? "unknown";
    const amount = parseFloat(d.properties?.amount ?? "0");
    if (closedWonStages.has(stage)) { cwCount++; cwAmount += amount; continue; }
    if (closedLostStages.has(stage)) { clCount++; continue; }
    if (!dealsByStage[stage]) dealsByStage[stage] = { count: 0, amount: 0 };
    dealsByStage[stage].count++;
    dealsByStage[stage].amount += amount;
  }
  const stages = Object.entries(dealsByStage)
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([stageId, { count, amount }]) => ({
      stageId,
      label: stageLabel[stageId] ?? stageId,
      count,
      amount,
    }));
  const pipelineTotal = stages.reduce((s, st) => s + st.amount, 0);
  const conversionRate = (cwCount + clCount) > 0 ? (cwCount / (cwCount + clCount)) * 100 : 0;

  // 1. Save summary metric rows
  await db.metric.createMany({
    data: [
      { organizationId, category: "SALES", name: "pipeline_value", value: pipelineTotal, unit: "MXN", period: now, source: "HUBSPOT" },
      { organizationId, category: "SALES", name: "won_revenue", value: cwAmount, unit: "MXN", period: now, source: "HUBSPOT" },
      { organizationId, category: "SALES", name: "conversion_rate", value: conversionRate, unit: "%", period: now, source: "HUBSPOT" },
      { organizationId, category: "SALES", name: "total_deals", value: deals.length, period: now, source: "HUBSPOT" },
      { organizationId, category: "SALES", name: "total_contacts", value: contacts.length, period: now, source: "HUBSPOT" },
      { organizationId, category: "SALES", name: "new_contacts_month", value: newThisMonth, period: now, source: "HUBSPOT" },
      { organizationId, category: "SALES", name: "closed_won_count", value: cwCount, period: now, source: "HUBSPOT" },
    ],
  });

  // 2. Save full snapshot to integration.metadata for instant dashboard reads
  const snapshot = {
    contacts: { total: contacts.length, newThisMonth, byStage },
    pipeline: { stages, total: pipelineTotal, closedWon: { count: cwCount, amount: cwAmount }, closedLost: { count: clCount } },
    syncedAt: now.toISOString(),
  };
  await db.integration.update({
    where: { organizationId_type: { organizationId, type: "HUBSPOT" } },
    data: { metadata: snapshot, lastSyncAt: now },
  });
}
