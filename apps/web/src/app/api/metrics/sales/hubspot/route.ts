import { NextRequest, NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/get-org";
import { db } from "@/server/db";
import { ensureValidToken } from "@/server/services/integrations/token-refresh";

// HubSpot API types
interface HubSpotContact {
  id: string;
  properties: {
    lifecyclestage?: string;
    createdate?: string;
  };
}

interface HubSpotContactsResponse {
  results: HubSpotContact[];
  paging?: { next?: { after?: string } };
}

interface HubSpotDeal {
  id: string;
  properties: {
    dealname?: string;
    amount?: string;
    dealstage?: string;
    closedate?: string;
    pipeline?: string;
  };
}

interface HubSpotDealsResponse {
  results: HubSpotDeal[];
  paging?: { next?: { after?: string } };
}

interface HubSpotStage {
  id: string;
  label: string;
  metadata?: { probability?: string; isClosed?: string };
}

interface HubSpotPipeline {
  id: string;
  label: string;
  stages: HubSpotStage[];
}

interface HubSpotPipelinesResponse {
  results: HubSpotPipeline[];
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

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getLifecycleLabel(stage: string): string {
  return LIFECYCLE_LABELS[stage.toLowerCase()] ?? capitalize(stage);
}

async function fetchAllContacts(accessToken: string): Promise<HubSpotContact[]> {
  const all: HubSpotContact[] = [];
  let after: string | undefined;
  let fetched = 0;
  while (fetched < 500) {
    const url = new URL("https://api.hubapi.com/crm/v3/objects/contacts");
    url.searchParams.set("limit", "100");
    url.searchParams.set("properties", "lifecyclestage,createdate");
    if (after) url.searchParams.set("after", after);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`HubSpot contacts error: ${res.status}`);
    const data: HubSpotContactsResponse = await res.json();
    all.push(...data.results);
    fetched += data.results.length;
    after = data.paging?.next?.after;
    if (!after || data.results.length === 0) break;
  }
  return all;
}

async function fetchAllDeals(accessToken: string): Promise<HubSpotDeal[]> {
  const all: HubSpotDeal[] = [];
  let after: string | undefined;
  let fetched = 0;
  while (fetched < 500) {
    const url = new URL("https://api.hubapi.com/crm/v3/objects/deals");
    url.searchParams.set("limit", "100");
    url.searchParams.set("properties", "dealname,amount,dealstage,closedate,pipeline");
    if (after) url.searchParams.set("after", after);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`HubSpot deals error: ${res.status}`);
    const data: HubSpotDealsResponse = await res.json();
    all.push(...data.results);
    fetched += data.results.length;
    after = data.paging?.next?.after;
    if (!after || data.results.length === 0) break;
  }
  return all;
}

async function fetchPipelines(accessToken: string): Promise<HubSpotPipeline[]> {
  const res = await fetch("https://api.hubapi.com/crm/v3/pipelines/deals", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`HubSpot pipelines error: ${res.status}`);
  const data: HubSpotPipelinesResponse = await res.json();
  return data.results;
}

export async function GET(req: NextRequest) {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const integration = await db.integration.findUnique({
    where: { organizationId_type: { organizationId, type: "HUBSPOT" } },
  });

  if (!integration || !integration.isActive) {
    return NextResponse.json({ connected: false });
  }

  try {
    const accessToken = await ensureValidToken(organizationId, "HUBSPOT");
    if (!accessToken) throw new Error("No access token available");

    const [contacts, deals, pipelines] = await Promise.all([
      fetchAllContacts(accessToken),
      fetchAllDeals(accessToken),
      fetchPipelines(accessToken),
    ]);

    // Process contacts
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let newThisMonth = 0;
    const stageCounts: Record<string, number> = {};
    for (const contact of contacts) {
      const createdate = contact.properties.createdate;
      if (createdate && new Date(createdate) >= firstOfMonth) {
        newThisMonth++;
      }
      const stage = contact.properties.lifecyclestage ?? "other";
      stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;
    }
    const byStage = Object.entries(stageCounts).map(([stage, count]) => ({
      stage,
      label: getLifecycleLabel(stage),
      count,
    }));

    // Identify closed stages from pipelines
    const closedWonStageIds = new Set<string>();
    const closedLostStageIds = new Set<string>();
    const stageLabelMap: Record<string, string> = {};
    for (const pipeline of pipelines) {
      for (const stage of pipeline.stages) {
        stageLabelMap[stage.id] = stage.label;
        const prob = stage.metadata?.probability;
        if (prob === "1.0" || stage.id.includes("closedwon") || stage.id === "closedwon") {
          closedWonStageIds.add(stage.id);
        }
        if (prob === "0.0" || stage.id.includes("closedlost") || stage.id === "closedlost") {
          closedLostStageIds.add(stage.id);
        }
      }
    }

    // Process deals
    const dealsByStage: Record<string, { count: number; amount: number }> = {};
    let closedWonCount = 0;
    let closedWonAmount = 0;
    let closedLostCount = 0;

    for (const deal of deals) {
      const stageId = deal.properties.dealstage ?? "unknown";
      const amount = parseFloat(deal.properties.amount ?? "0") || 0;
      if (closedWonStageIds.has(stageId)) {
        closedWonCount++;
        closedWonAmount += amount;
      } else if (closedLostStageIds.has(stageId)) {
        closedLostCount++;
      } else {
        if (!dealsByStage[stageId]) dealsByStage[stageId] = { count: 0, amount: 0 };
        dealsByStage[stageId].count++;
        dealsByStage[stageId].amount += amount;
      }
    }

    const pipelineStages = Object.entries(dealsByStage).map(([stageId, data]) => ({
      stageId,
      label: stageLabelMap[stageId] ?? capitalize(stageId),
      count: data.count,
      amount: data.amount,
    }));

    const pipelineValue = pipelineStages.reduce((sum, s) => sum + s.amount, 0);

    // Save metrics to DB
    await db.metric.createMany({
      data: [
        { source: "HUBSPOT", organizationId, category: "SALES", name: "total_contacts", value: contacts.length, period: now },
        { source: "HUBSPOT", organizationId, category: "SALES", name: "new_contacts_month", value: newThisMonth, period: now },
        { source: "HUBSPOT", organizationId, category: "SALES", name: "pipeline_value", value: pipelineValue, period: now },
        { source: "HUBSPOT", organizationId, category: "SALES", name: "closed_won_count", value: closedWonCount, period: now },
        { source: "HUBSPOT", organizationId, category: "SALES", name: "closed_won_amount", value: closedWonAmount, period: now },
      ],
    }).catch(() => {}); // Don't fail if metrics save fails

    return NextResponse.json({
      connected: true,
      contacts: {
        total: contacts.length,
        newThisMonth,
        byStage,
      },
      pipeline: {
        stages: pipelineStages,
        closedWon: { count: closedWonCount, amount: closedWonAmount },
        closedLost: { count: closedLostCount },
      },
      lastSyncAt: now.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ connected: true, error: message }, { status: 500 });
  }
}
