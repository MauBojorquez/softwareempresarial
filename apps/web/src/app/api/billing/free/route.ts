import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

// Switch an organization to the free plan. No Stripe checkout is needed; if the
// org has an active paid Stripe subscription it is canceled first so they stop
// being billed.
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

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    include: { organization: { include: { subscription: true } } },
  });

  if (!membership) {
    return NextResponse.json({ error: "No organization found" }, { status: 404 });
  }

  const sub = membership.organization.subscription;

  // Cancel any active paid Stripe subscription so they stop being billed.
  if (sub?.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
    try {
      const { stripe } = await import("@/lib/stripe");
      await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
    } catch (err) {
      console.error("Failed to cancel Stripe subscription on free downgrade:", err);
    }
  }

  await db.subscription.upsert({
    where: { organizationId: membership.organizationId },
    create: {
      organizationId: membership.organizationId,
      stripeCustomerId: `cus_free_${membership.organizationId}`,
      plan: "FREE",
      status: "ACTIVE",
      interval: "MONTHLY",
    },
    update: {
      plan: "FREE",
      status: "ACTIVE",
      stripeSubscriptionId: null,
      stripePriceId: null,
    },
  });

  return NextResponse.json({ success: true, plan: "FREE" });
}
