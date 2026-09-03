import { NextRequest, NextResponse } from "next/server";
import type { JobRole } from "@prisma/client";
import { db } from "@/server/db";
import { requireAccess } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { notify } from "@/server/services/push/notify";
import { todayMX, isValidDate } from "@/lib/day";
import {
  SUBMITTER_ROLES,
  isSubmitterRole,
  validatePayload,
  computeOperaciones,
} from "@/lib/daily-report";

export const dynamic = "force-dynamic";

type ReportOut = {
  id: string;
  fecha: string;
  jobRole: JobRole | null;
  payload: unknown;
  userId: string;
  authorName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function shape(r: {
  id: string;
  fecha: string;
  jobRole: JobRole | null;
  payload: unknown;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  user?: { name: string | null; email: string } | null;
}): ReportOut {
  return {
    id: r.id,
    fecha: r.fecha,
    jobRole: r.jobRole,
    payload: r.payload,
    userId: r.userId,
    authorName: r.user?.name ?? r.user?.email ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// GET /api/reportes
//   ?scope=all  → DIRECCION consolidated view (gated "reportes_all")
//   otherwise   → the caller's own report + history (gated "reporte_propio")
export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope");
  const today = todayMX();

  if (scope === "all") {
    const access = await requireAccess(req, "reportes_all");
    if (access instanceof NextResponse) return access;
    const { orgId } = access;

    const fechaParam = req.nextUrl.searchParams.get("fecha");
    const fecha = fechaParam && isValidDate(fechaParam) ? fechaParam : today;

    const reports = await db.dailyReport.findMany({
      where: { organizationId: orgId, fecha },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { updatedAt: "desc" },
    });

    // All org members whose puesto submits a daily report, with submitted state
    // for the requested day.
    const members = await db.membership.findMany({
      where: { organizationId: orgId, jobRole: { in: SUBMITTER_ROLES } },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: "asc" } },
    });

    const submittedBy = new Set(reports.map((r) => r.userId));
    const memberStatus = members.map((m) => ({
      userId: m.userId,
      name: m.user.name ?? m.user.email,
      jobRole: m.jobRole,
      submitted: submittedBy.has(m.userId),
    }));

    return NextResponse.json({
      scope: "all",
      today,
      fecha,
      reports: reports.map(shape),
      members: memberStatus,
    });
  }

  // ── Own report ──
  const access = await requireAccess(req, "reporte_propio");
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole, userId } = access;

  const fechaParam = req.nextUrl.searchParams.get("fecha");
  const fecha = fechaParam && isValidDate(fechaParam) ? fechaParam : today;

  const report = await db.dailyReport.findUnique({
    where: { userId_fecha: { userId, fecha } },
    include: { user: { select: { name: true, email: true } } },
  });

  const history = await db.dailyReport.findMany({
    where: { userId, organizationId: orgId },
    orderBy: { fecha: "desc" },
    take: 60,
  });

  const computed =
    jobRole === "OPERACIONES" ? await computeOperaciones(orgId) : null;

  return NextResponse.json({
    scope: "own",
    jobRole,
    today,
    fecha,
    frozen: fecha !== today,
    report: report ? shape(report) : null,
    history: history.map((h) => ({
      id: h.id,
      fecha: h.fecha,
      jobRole: h.jobRole,
      payload: h.payload,
      updatedAt: h.updatedAt,
    })),
    computed,
  });
}

// POST /api/reportes — upsert the caller's report for TODAY only.
export async function POST(req: NextRequest) {
  const access = await requireAccess(req, "reporte_propio");
  if (access instanceof NextResponse) return access;
  const { orgId, jobRole, userId } = access;

  if (!isSubmitterRole(jobRole)) {
    return NextResponse.json(
      { error: "Tu puesto no envía reporte diario" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const rawPayload = (body?.payload ?? body ?? {}) as Record<string, unknown>;

  const validated = validatePayload(jobRole as JobRole, rawPayload);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  let payload = validated.payload;

  // Read-only server-computed fields for OPERACIONES overwrite any client value.
  if (jobRole === "OPERACIONES") {
    const computed = await computeOperaciones(orgId);
    payload = {
      ...payload,
      velocidadDelMes: computed.velocidadDelMes,
      saludGeneral: computed.saludGeneral,
      counts: computed.counts,
    };
  }

  const fecha = todayMX(); // always today; client-sent fecha is ignored.

  const saved = await db.dailyReport.upsert({
    where: { userId_fecha: { userId, fecha } },
    create: {
      fecha,
      jobRole: jobRole as JobRole,
      payload: payload as object,
      userId,
      organizationId: orgId,
    },
    update: {
      jobRole: jobRole as JobRole,
      payload: payload as object,
    },
    include: { user: { select: { name: true, email: true } } },
  });

  await logActivity({
    userId,
    organizationId: orgId,
    action: "report.submit",
    detail: `${jobRole} ${fecha}`,
    path: "/dashboard/reportes",
  });

  // Notify Dirección that a collaborator submitted their daily report.
  try {
    const autor = saved.user?.name ?? saved.user?.email ?? "Un colaborador";
    const direccion = await db.membership.findMany({
      where: { organizationId: orgId, jobRole: "DIRECCION" },
      select: { userId: true },
    });
    await Promise.all(
      direccion.map((m) =>
        notify({
          userId: m.userId,
          title: "Reporte diario enviado",
          message: `${autor} envió su reporte diario.`,
          type: "report",
          url: "/dashboard/reportes",
        }),
      ),
    );
  } catch {
    // best-effort; notification failures never block the report submission
  }

  return NextResponse.json({ report: shape(saved) });
}
