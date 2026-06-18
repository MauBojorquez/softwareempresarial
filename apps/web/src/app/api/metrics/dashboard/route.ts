import { NextRequest, NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/get-org";
import { db } from "@/server/db";

export async function GET(req: NextRequest) {
  const orgId = await getOrganizationId(req);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const metrics = await db.metric.findMany({
    where: { organizationId: orgId },
    orderBy: { period: "desc" },
    take: 100,
  });

  const latest = (name: string) => metrics.find((m) => m.name === name);
  const previous = (name: string) => metrics.filter((m) => m.name === name)[1];

  const calc = (name: string) => {
    const curr = latest(name);
    const prev = previous(name);
    const value = curr?.value ?? 0;
    const change = prev ? ((value - prev.value) / prev.value) * 100 : 0;
    return { value, change: parseFloat(change.toFixed(1)) };
  };

  const revenue = calc("Ingresos");
  const pipeline = calc("Pipeline Total");
  const headcount = calc("Headcount");

  const leads = latest("Nuevos Leads")?.value ?? 0;
  const deals = latest("Deals Cerrados")?.value ?? 0;
  const conversion = leads > 0 ? parseFloat(((deals / leads) * 100).toFixed(1)) : 0;

  const prevLeads = previous("Nuevos Leads")?.value ?? 0;
  const prevDeals = previous("Deals Cerrados")?.value ?? 0;
  const prevConversion = prevLeads > 0 ? (prevDeals / prevLeads) * 100 : 0;
  const conversionChange = prevConversion > 0 ? parseFloat(((conversion - prevConversion) / prevConversion * 100).toFixed(1)) : 0;

  return NextResponse.json({
    revenue: revenue.value,
    revenueChange: revenue.change,
    pipeline: pipeline.value,
    pipelineChange: pipeline.change,
    employees: headcount.value,
    employeesChange: headcount.change,
    conversion,
    conversionChange,
    hasData: metrics.length > 0,
  });
}
