import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { createCheckoutSession } from "@/server/services/billing/stripe-service";
import type { Plan, BillingInterval } from "@prisma/client";

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !origin.includes(host.split(":")[0])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const VALID_PLANS: Plan[] = ["STARTER", "PROFESSIONAL", "ENTERPRISE"];
  const VALID_INTERVALS: BillingInterval[] = ["MONTHLY", "ANNUAL"];
  if (!VALID_PLANS.includes(body.plan) || !VALID_INTERVALS.includes(body.interval)) {
    return NextResponse.json({ error: "Plan o intervalo inválido" }, { status: 400 });
  }
  const plan = body.plan as Plan;
  const interval = body.interval as BillingInterval;

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
  });

  if (!membership) {
    return NextResponse.json({ error: "No organization found" }, { status: 404 });
  }

  if (membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo administradores pueden cambiar el plan" }, { status: 403 });
  }

  const checkoutOrigin = origin || req.nextUrl.origin;

  try {
    const checkoutSession = await createCheckoutSession(
      membership.organizationId,
      plan,
      interval,
      session.user.email!,
      checkoutOrigin
    );
    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Error al crear sesión de pago. Intenta de nuevo." }, { status: 500 });
  }
}
