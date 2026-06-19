import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { ensureValidToken } from "@/server/services/integrations/token-refresh";

const HS = "https://api.hubapi.com";

async function hsFetch(token: string, path: string) {
  const res = await fetch(`${HS}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`HubSpot ${path} → ${res.status}`);
  return res.json();
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

async function fetchAllPages(
  token: string,
  basePath: string,
  limit = 100
): Promise<any[]> {
  const results: any[] = [];
  let after: string | undefined;
  for (let page = 0; page < 100; page++) {
    const url = `${basePath}&limit=${limit}${after ? `&after=${after}` : ""}`;
    const data = await hsFetch(token, url);
    results.push(...(data.results ?? []));
    after = data.paging?.next?.after;
    if (!after) break;
  }
  return results;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await db.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 404 });

  const { organizationId } = membership;

  const integration = await db.integration.findUnique({
    where: { organizationId_type: { organizationId, type: "HUBSPOT" } },
  });
  if (!integration?.isActive) return NextResponse.json({ connected: false });

  try {
    const token = await ensureValidToken(organizationId, "HUBSPOT");

    const [contacts, deals, pipelinesData] = await Promise.all([
      fetchAllPages(token, "/crm/v3/objects/contacts?properties=lifecyclestage,createdate"),
      fetchAllPages(token, "/crm/v3/objects/deals?properties=dealname,amount,dealstage,closedate,pipeline"),
      hsFetch(token, "/crm/v3/pipelines/deals"),
    ]);

    // Build stage id→label map from pipeline definitions
    const stageLabel: Record<string, string> = {};
    const closedWonStages = new Set<string>();
    const closedLostStages = new Set<string>();
    for (const pipe of pipelinesData.results ?? []) {
      for (const s of pipe.stages ?? []) {
        stageLabel[s.id] = s.label;
        if (s.metadata?.isClosed === "true" || s.metadata?.probability === "1.0") closedWonStages.add(s.id);
        if (s.metadata?.isClosed === "true" || s.metadata?.probability === "0.0") {
          if (s.metadata?.probability === "0.0") closedLostStages.add(s.id);
        }
        // Common HubSpot default stage IDs
        if (s.id === "closedwon") closedWonStages.add(s.id);
        if (s.id === "closedlost") closedLostStages.add(s.id);
      }
    }

    // Contacts by lifecycle stage
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const stageCount: Record<string, number> = {};
    let newThisMonth = 0;

    for (const c of contacts) {
      const stage = c.properties?.lifecyclestage ?? "other";
      stageCount[stage] = (stageCount[stage] ?? 0) + 1;
      const created = new Date(c.properties?.createdate ?? 0).getTime();
      if (created >= monthStart) newThisMonth++;
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

    // Save summary metrics to DB
    const period = new Date();
    await db.metric.createMany({
      data: [
        { organizationId, category: "SALES", name: "total_contacts", value: contacts.length, period, source: "HUBSPOT" },
        { organizationId, category: "SALES", name: "new_contacts_month", value: newThisMonth, period, source: "HUBSPOT" },
        { organizationId, category: "SALES", name: "pipeline_value", value: pipelineTotal, unit: "MXN", period, source: "HUBSPOT" },
        { organizationId, category: "SALES", name: "closed_won_count", value: cwCount, period, source: "HUBSPOT" },
        { organizationId, category: "SALES", name: "closed_won_amount", value: cwAmount, unit: "MXN", period, source: "HUBSPOT" },
      ],
      skipDuplicates: true,
    });

    return NextResponse.json({
      connected: true,
      contacts: { total: contacts.length, newThisMonth, byStage },
      pipeline: {
        stages,
        total: pipelineTotal,
        closedWon: { count: cwCount, amount: cwAmount },
        closedLost: { count: clCount },
      },
      lastSyncAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("HubSpot sales fetch error:", err);
    return NextResponse.json({ connected: true, error: err.message });
  }
}
