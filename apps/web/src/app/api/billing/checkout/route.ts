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

  const { plan, interval } = (await req.json()) as { plan: Plan; interval: BillingInterval };

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
  });

  if (!membership) {
    return NextResponse.json({ error: "No organization found" }, { status: 404 });
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error creating checkout" }, { status: 500 });
  }
}
