import { db } from "@/server/db";
import { ensureValidToken } from "./token-refresh";

const HS = "https://api.hubapi.com";

async function hsFetch(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${HS}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HubSpot ${path} → ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/** POST to /crm/v3/objects/<type>/search — returns { results, total } */
async function hsSearch(token: string, objectType: string, body: object) {
  return hsFetch(token, `/crm/v3/objects/${objectType}/search`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const LIFECYCLE_LABELS: Record<string, string> = {
  subscriber: "Suscriptor",
  lead: "Lead",
  marketingqualifiedlead: "MQL",
  salesqualifiedlead: "SQL",
  opportunity: "Oportunidad",
  customer: "Cliente",
  evangelist: "Evangelista",
  other: "Otro",
};

const LIFECYCLE_STAGES = [
  "subscriber", "lead", "marketingqualifiedlead", "salesqualifiedlead",
  "opportunity", "customer", "evangelist", "other",
];

// Kept for backwards compat
export async function getHubSpotClient(organizationId: string) {
  const integration = await db.integration.findUnique({
    where: { organizationId_type: { organizationId, type: "HUBSPOT" } },
  });
  if (!integration || !integration.isActive) throw new Error("HubSpot integration not found or inactive");
  const accessToken = await ensureValidToken(organizationId, "HUBSPOT");
  return { accessToken };
}

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
 * Efficient sync: uses HubSpot search API to get aggregate counts/amounts
 * per stage WITHOUT paginating every record. ~20 fast API calls instead of
 * hundreds of pages that would timeout on Vercel.
 *
 * The search endpoint returns `total` (exact count) on every response, so we
 * can get counts in a single call per stage. For amounts we fetch up to 100
 * deals per stage (covers the vast majority of real pipeline stages).
 */
export async function syncSalesMetrics(organizationId: string) {
  const now = new Date();
  const token = await ensureValidToken(organizationId, "HUBSPOT");

  // 1. Pipeline stage definitions
  const pipelinesData = await hsFetch(token, "/crm/v3/pipelines/deals");
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
  const allStageIds = Object.keys(stageLabel);

  // 2. Contacts: count per lifecycle stage using search (1 call each)
  //    and new-this-month count with a date filter
  const monthStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const monthStartStr = new Date(monthStartMs).toISOString();

  const [contactStageResults, newContactsResult] = await Promise.all([
    Promise.all(
      LIFECYCLE_STAGES.map((stage) =>
        hsSearch(token, "contacts", {
          filterGroups: [{ filters: [{ propertyName: "lifecyclestage", operator: "EQ", value: stage }] }],
          properties: ["lifecyclestage"],
          limit: 1,
        }).then((r) => ({ stage, total: r.total as number })).catch(() => ({ stage, total: 0 }))
      )
    ),
    hsSearch(token, "contacts", {
      filterGroups: [{ filters: [{ propertyName: "createdate", operator: "GTE", value: monthStartStr }] }],
      properties: ["createdate"],
      limit: 1,
    }).then((r) => r.total as number).catch(() => 0),
  ]);

  const byStage = contactStageResults
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total)
    .map(({ stage, total }) => ({
      stage,
      label: LIFECYCLE_LABELS[stage] ?? stage.charAt(0).toUpperCase() + stage.slice(1),
      count: total,
    }));
  const totalContacts = contactStageResults.reduce((s, r) => s + r.total, 0);
  const newThisMonth = newContactsResult;

  // 3. Deals per stage: get count (from total) + sum amounts (first 100 per stage)
  //    Active pipeline stages + closed-won + closed-lost
  const activeStageIds = allStageIds.filter(
    (id) => !closedWonStages.has(id) && !closedLostStages.has(id)
  );

  const [activeStageData, cwData, clData] = await Promise.all([
    Promise.all(
      activeStageIds.map((stageId) =>
        hsSearch(token, "deals", {
          filterGroups: [{ filters: [{ propertyName: "dealstage", operator: "EQ", value: stageId }] }],
          properties: ["amount", "dealstage"],
          limit: 100,
        })
          .then((r) => ({
            stageId,
            count: r.total as number,
            amount: (r.results as any[]).reduce((s: number, d: any) => s + parseFloat(d.properties?.amount ?? "0"), 0),
          }))
          .catch(() => ({ stageId, count: 0, amount: 0 }))
      )
    ),
    // Closed won: sum first 100 amounts
    Promise.all(
      Array.from(closedWonStages).map((stageId) =>
        hsSearch(token, "deals", {
          filterGroups: [{ filters: [{ propertyName: "dealstage", operator: "EQ", value: stageId }] }],
          properties: ["amount"],
          limit: 100,
        })
          .then((r) => ({
            count: r.total as number,
            amount: (r.results as any[]).reduce((s: number, d: any) => s + parseFloat(d.properties?.amount ?? "0"), 0),
          }))
          .catch(() => ({ count: 0, amount: 0 }))
      )
    ),
    // Closed lost: count only
    Promise.all(
      Array.from(closedLostStages).map((stageId) =>
        hsSearch(token, "deals", {
          filterGroups: [{ filters: [{ propertyName: "dealstage", operator: "EQ", value: stageId }] }],
          properties: ["dealstage"],
          limit: 1,
        })
          .then((r) => r.total as number)
          .catch(() => 0)
      )
    ),
  ]);

  const stages = activeStageData
    .filter((s) => s.count > 0)
    .sort((a, b) => b.amount - a.amount)
    .map(({ stageId, count, amount }) => ({
      stageId,
      label: stageLabel[stageId] ?? stageId,
      count,
      amount,
    }));

  const pipelineTotal = stages.reduce((s, st) => s + st.amount, 0);
  const cwCount = cwData.reduce((s, d) => s + d.count, 0);
  const cwAmount = cwData.reduce((s, d) => s + d.amount, 0);
  const clCount = clData.reduce((s, n) => s + n, 0);
  const totalDeals = activeStageData.reduce((s, d) => s + d.count, 0) + cwCount + clCount;
  const conversionRate = (cwCount + clCount) > 0 ? (cwCount / (cwCount + clCount)) * 100 : 0;

  // 4. Save metric rows (delete-then-insert for idempotency)
  const period = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  await db.metric.deleteMany({ where: { organizationId, source: "HUBSPOT", period } });
  await db.metric.createMany({
    data: [
      { organizationId, category: "SALES", name: "pipeline_value", value: pipelineTotal, unit: "MXN", period, source: "HUBSPOT" },
      { organizationId, category: "SALES", name: "won_revenue", value: cwAmount, unit: "MXN", period, source: "HUBSPOT" },
      { organizationId, category: "SALES", name: "conversion_rate", value: conversionRate, unit: "%", period, source: "HUBSPOT" },
      { organizationId, category: "SALES", name: "total_deals", value: totalDeals, period, source: "HUBSPOT" },
      { organizationId, category: "SALES", name: "total_contacts", value: totalContacts, period, source: "HUBSPOT" },
      { organizationId, category: "SALES", name: "new_contacts_month", value: newThisMonth, period, source: "HUBSPOT" },
      { organizationId, category: "SALES", name: "closed_won_count", value: cwCount, period, source: "HUBSPOT" },
    ],
  });

  // 5. Save full snapshot to integration.metadata for instant dashboard reads
  const snapshot = {
    contacts: { total: totalContacts, newThisMonth, byStage },
    pipeline: {
      stages,
      total: pipelineTotal,
      closedWon: { count: cwCount, amount: cwAmount },
      closedLost: { count: clCount },
    },
    syncedAt: now.toISOString(),
  };
  await db.integration.update({
    where: { organizationId_type: { organizationId, type: "HUBSPOT" } },
    data: { metadata: snapshot, lastSyncAt: now },
  });
}
