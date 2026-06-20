import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

async function fetchWithTimeout(url: string, ms = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Action types grouped by what Meta counts as a "Result" per objective.
const PURCHASE = ["offsite_conversion.fb_pixel_purchase", "omni_purchase", "purchase", "omni_purchase_value"];
const LEAD = ["offsite_conversion.fb_pixel_lead", "leadgen.other", "onsite_conversion.lead_grouped", "lead", "contact", "submit_application"];
const REGISTRATION = ["offsite_conversion.fb_pixel_complete_registration", "complete_registration"];
// Meta uses both prefixed and non-prefixed forms depending on account/campaign type
const MESSAGING = [
  "onsite_conversion.messaging_conversation_started_7d",
  "messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
  "onsite_conversion.messaging_first_reply",
];
const LINK = ["link_click"];
const LANDING = ["landing_page_view"];
const ENGAGEMENT = ["post_engagement", "page_engagement"];
const VIDEO = ["video_view"];
const APP_INSTALL = ["omni_app_install", "mobile_app_install"];
const PAGE_LIKE = ["like"];

// objective -> ordered list of action groups to check (first non-null wins)
const OBJECTIVE_RESULTS: Record<string, string[][]> = {
  OUTCOME_SALES: [PURCHASE, LEAD, REGISTRATION],
  OUTCOME_LEADS: [LEAD, MESSAGING, REGISTRATION, PURCHASE],
  OUTCOME_ENGAGEMENT: [MESSAGING, ENGAGEMENT, LINK],
  OUTCOME_TRAFFIC: [LINK, LANDING],
  OUTCOME_AWARENESS: [],
  OUTCOME_APP_PROMOTION: [APP_INSTALL],
  CONVERSIONS: [PURCHASE, LEAD, REGISTRATION],
  LEAD_GENERATION: [LEAD, MESSAGING],
  MESSAGES: [MESSAGING],
  LINK_CLICKS: [LINK, LANDING],
  POST_ENGAGEMENT: [ENGAGEMENT],
  PAGE_LIKES: [PAGE_LIKE],
  VIDEO_VIEWS: [VIDEO],
  REACH: [],
  BRAND_AWARENESS: [],
  APP_INSTALLS: [APP_INSTALL],
};

const FALLBACK_PRIORITY = [
  ...PURCHASE, ...LEAD, ...REGISTRATION, ...MESSAGING, ...APP_INSTALL,
  ...LANDING, ...LINK, ...ENGAGEMENT, ...VIDEO, ...PAGE_LIKE,
];

// optimization_goal of the ad set -> ordered action groups. This is what Meta
// actually uses to compute the "Results" column, so it is checked BEFORE the
// campaign objective (a OUTCOME_LEADS campaign optimized for CONVERSATIONS
// reports messaging conversations, not lead forms).
const OPT_GOAL_RESULTS: Record<string, string[][]> = {
  CONVERSATIONS: [MESSAGING],
  LEAD_GENERATION: [LEAD],
  QUALITY_LEAD: [LEAD],
  QUALITY_CALL: [LEAD],
  OFFSITE_CONVERSIONS: [PURCHASE, LEAD, REGISTRATION],
  VALUE: [PURCHASE],
  LANDING_PAGE_VIEWS: [LANDING],
  LINK_CLICKS: [LINK],
  POST_ENGAGEMENT: [ENGAGEMENT],
  PAGE_LIKES: [PAGE_LIKE],
  THRUPLAY: [VIDEO],
  TWO_SECOND_CONTINUOUS_VIDEO_VIEWS: [VIDEO],
  APP_INSTALLS: [APP_INSTALL],
  REACH: [],
  IMPRESSIONS: [],
  AD_RECALL_LIFT: [],
};

// Extracts the "Results" number for a campaign exactly as Meta Ads Manager would.
// optimizationGoal (from the ad set) takes priority over the campaign objective.
function extractResults(
  objective: string,
  actions: any[],
  optimizationGoal?: string | null
): { value: number; type: string | null } {
  if (!Array.isArray(actions) || actions.length === 0) return { value: 0, type: null };
  const valueOf = (type: string): number | null => {
    const a = actions.find((x) => x.action_type === type);
    if (!a) return null;
    const n = parseFloat(a.value || "0");
    return n; // can be 0 — caller decides whether to skip
  };
  // Returns the first action type with value > 0, skipping types that exist but are zero.
  const firstOf = (types: string[]): { value: number; type: string } | null => {
    for (const t of types) {
      const v = valueOf(t);
      if (v !== null && v > 0) return { value: Math.round(v), type: t };
    }
    return null;
  };

  // 1) Most accurate: the ad set's optimization goal (what Meta's "Results" uses).
  if (optimizationGoal && OPT_GOAL_RESULTS[optimizationGoal]) {
    const groups = OPT_GOAL_RESULTS[optimizationGoal];
    for (const group of groups) {
      const hit = firstOf(group);
      if (hit) return hit;
    }
    if (groups.length === 0) return { value: 0, type: null };
  }

  // 2) Fallback to the campaign objective.
  const groups = OBJECTIVE_RESULTS[objective];
  if (groups) {
    for (const group of groups) {
      const hit = firstOf(group);
      if (hit) return hit;
    }
    // Awareness/reach objectives have no action-based result.
    if (groups.length === 0) return { value: 0, type: null };
  }

  const fallback = firstOf(FALLBACK_PRIORITY);
  return fallback ?? { value: 0, type: null };
}

// Human label for the result type, matching Meta's wording.
function resultLabel(type: string | null): string {
  if (!type) return "Resultados";
  if (MESSAGING.includes(type)) return "Conversaciones";
  if (PURCHASE.includes(type)) return "Compras";
  if (LEAD.includes(type)) return "Clientes potenciales";
  if (REGISTRATION.includes(type)) return "Registros";
  if (LINK.includes(type)) return "Clics en el enlace";
  if (LANDING.includes(type)) return "Vistas de página";
  if (ENGAGEMENT.includes(type)) return "Interacciones";
  if (VIDEO.includes(type)) return "Reproducciones";
  if (APP_INSTALL.includes(type)) return "Instalaciones";
  if (PAGE_LIKE.includes(type)) return "Me gusta";
  return "Resultados";
}

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
    const tokenCheck = await fetchWithTimeout(
      `https://graph.facebook.com/v21.0/debug_token?input_token=${accessToken}&access_token=${accessToken}`
    );
    if (tokenCheck.ok) {
      const tokenData = await tokenCheck.json();
      if (tokenData.data && !tokenData.data.is_valid) {
        return NextResponse.json({
          connected: true,
          campaigns: [],
          monthly: [],
          adAccounts,
          tokenExpired: true,
          error: tokenData.data.error?.message || "Tu token de Meta Ads expiró. Reconecta desde Integraciones.",
        });
      }
    }

    // Persist the chosen account so the background sync (alerts, overview,
    // digest) uses the same single account the user is looking at — not the
    // sum of every ad account, which inflates the numbers.
    if (selectedAccountId && metadata?.selectedAccountId !== selectedAccountId) {
      await db.integration.update({
        where: { id: integration.id },
        data: { metadata: { ...metadata, selectedAccountId } },
      }).catch(() => {});
    }

    const accountsToFetch = selectedAccountId
      ? adAccounts.filter((a) => a.id === selectedAccountId)
      : [adAccounts[0]];

    if (accountsToFetch.length === 0) {
      return NextResponse.json({ connected: true, campaigns: [], monthly: [], adAccounts, error: "Cuenta no encontrada" });
    }

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sinceCurrent = thisMonthStart.toISOString().split("T")[0];
    const untilCurrent = now.toISOString().split("T")[0];

    // Fetch campaigns from all accounts in parallel
    const campaignResults = await Promise.allSettled(
      accountsToFetch.map(async (account) => {
        // Fetch campaigns (with insights) and ad set optimization goals in parallel.
        const [res, adsetRes] = await Promise.all([
          fetchWithTimeout(
            `https://graph.facebook.com/v21.0/${account.id}/campaigns?` +
            `fields=id,name,status,effective_status,objective,` +
            `insights.time_range({"since":"${sinceCurrent}","until":"${untilCurrent}"}){spend,impressions,clicks,ctr,cpc,reach,actions,action_values}` +
            `&limit=100&access_token=${accessToken}`
          ),
          fetchWithTimeout(
            `https://graph.facebook.com/v21.0/${account.id}/adsets?` +
            `fields=campaign_id,optimization_goal&limit=500&access_token=${accessToken}`
          ),
        ]);
        if (!res.ok) return [];
        const data = await res.json();
        if (data.error) return [];

        // Map campaign_id -> optimization_goal (first ad set wins; campaigns rarely mix goals).
        const optGoalByCampaign: Record<string, string> = {};
        if (adsetRes.ok) {
          const adsetData = await adsetRes.json();
          for (const s of adsetData.data || []) {
            if (s.campaign_id && s.optimization_goal && !optGoalByCampaign[s.campaign_id]) {
              optGoalByCampaign[s.campaign_id] = s.optimization_goal;
            }
          }
        }

        return (data.data || []).map((c: any) => {
          const insights = c.insights?.data?.[0] || {};
          // Also check action_values for purchase-value objectives, but use actions count for results
          const allActions: any[] = [
            ...(insights.actions || []),
            ...(insights.action_values || []),
          ].filter((a, i, arr) => arr.findIndex((b) => b.action_type === a.action_type) === i);
          const { value: results, type: resultType } = extractResults(
            c.objective || "",
            allActions,
            optGoalByCampaign[c.id]
          );
          const spend = parseFloat(insights.spend || "0");
          return {
            id: c.id,
            name: c.name,
            status: c.effective_status || c.status,
            objective: c.objective,
            spend,
            impressions: parseInt(insights.impressions || "0"),
            clicks: parseInt(insights.clicks || "0"),
            ctr: parseFloat(insights.ctr || "0"),
            cpc: parseFloat(insights.cpc || "0"),
            reach: parseInt(insights.reach || "0"),
            results,
            resultType: resultLabel(resultType),
            costPerResult: results > 0 ? Math.round((spend / results) * 100) / 100 : 0,
            accountId: account.id,
            accountName: account.name || account.id,
          };
        });
      })
    );

    const allCampaigns = campaignResults
      .filter((r): r is PromiseFulfilledResult<any[]> => r.status === "fulfilled")
      .flatMap((r) => r.value)
      .sort((a, b) => b.spend - a.spend);

    // Build month ranges
    const monthRanges = Array.from({ length: months }, (_, i) => {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = i === 0 ? now : new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      return {
        since: start.toISOString().split("T")[0]!,
        until: end.toISOString().split("T")[0]!,
        monthName: start.toLocaleDateString("es-MX", { month: "short", year: "numeric" }),
      };
    });

    // Fetch all monthly insights in parallel (one call per account × month)
    const monthlyResults = await Promise.allSettled(
      monthRanges.map(async (range) => {
        const accountFetches = await Promise.allSettled(
          accountsToFetch.map(async (account) => {
            const res = await fetchWithTimeout(
              `https://graph.facebook.com/v21.0/${account.id}/insights?` +
              `fields=spend,impressions,clicks,reach` +
              `&time_range={"since":"${range.since}","until":"${range.until}"}` +
              `&access_token=${accessToken}`
            );
            if (!res.ok) return null;
            const data = await res.json();
            return data.data?.[0] || null;
          })
        );

        let spend = 0, impressions = 0, clicks = 0, reach = 0, hasData = false;
        for (const r of accountFetches) {
          if (r.status === "fulfilled" && r.value) {
            hasData = true;
            spend += parseFloat(r.value.spend || "0");
            impressions += parseInt(r.value.impressions || "0");
            clicks += parseInt(r.value.clicks || "0");
            reach += parseInt(r.value.reach || "0");
          }
        }

        return {
          month: range.monthName,
          spend,
          impressions,
          clicks,
          ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
          cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
          reach,
          hasData,
        };
      })
    );

    const monthly = monthlyResults
      .map((r) => r.status === "fulfilled" ? r.value : { month: "", spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, reach: 0, hasData: false })
      .reverse();

    // Overview summary is computed by SUMMING the campaigns (single source of truth).
    const summary = allCampaigns.reduce(
      (acc, c) => {
        acc.spend += c.spend;
        acc.impressions += c.impressions;
        acc.clicks += c.clicks;
        acc.reach += c.reach;
        acc.results += c.results;
        return acc;
      },
      { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 }
    );
    summary.ctr = summary.impressions > 0 ? Math.round((summary.clicks / summary.impressions) * 10000) / 100 : 0;
    summary.cpc = summary.clicks > 0 ? Math.round((summary.spend / summary.clicks) * 100) / 100 : 0;
    summary.cpm = summary.impressions > 0 ? Math.round((summary.spend / summary.impressions) * 1000 * 100) / 100 : 0;
    (summary as Record<string, unknown>).costPerResult = summary.results > 0 ? Math.round((summary.spend / summary.results) * 100) / 100 : 0;

    // % change vs previous month (from account-level monthly aggregates).
    const curMonth = monthly[monthly.length - 1];
    const prevMonth = monthly[monthly.length - 2];
    const pct = (curr: number, prev: number) =>
      prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : null;
    const changes = {
      spend: pct(summary.spend, prevMonth?.spend ?? 0),
      clicks: pct(summary.clicks, prevMonth?.clicks ?? 0),
      ctr: pct(summary.ctr, prevMonth?.ctr ?? 0),
    };
    void curMonth;

    return NextResponse.json({
      connected: true,
      campaigns: allCampaigns,
      monthly,
      summary,
      changes,
      activeCampaigns: allCampaigns.filter((c) => c.status === "ACTIVE").length,
      totalCampaigns: allCampaigns.length,
      adAccounts: adAccounts.map((a) => ({ id: a.id, name: a.name || a.id })),
      selectedAccountId: selectedAccountId || "all",
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
