import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { stripe } from "@/lib/stripe";
import { handleSubscriptionUpdated } from "@/server/services/billing/stripe-service";

// Pulls the latest subscription state directly from Stripe and syncs it to the DB.
// Called from the billing page to recover from missed webhooks.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    include: { organization: { include: { subscription: true } } },
  });

  const sub = membership?.organization?.subscription;
  if (!sub?.stripeCustomerId) return NextResponse.json({ error: "No subscription" }, { status: 404 });

  try {
    // Get all active/trialing subscriptions for this customer from Stripe.
    const stripeSubs = await stripe.subscriptions.list({
      customer: sub.stripeCustomerId,
      status: "all",
      limit: 10,
    });

    // Find the most relevant: trialing or active first, then most recent.
    const priority = ["trialing", "active", "past_due", "unpaid", "canceled"];
    const best = stripeSubs.data.sort((a, b) => {
      const ai = priority.indexOf(a.status);
      const bi = priority.indexOf(b.status);
      if (ai !== bi) return ai - bi;
      return b.created - a.created;
    })[0];

    if (!best) return NextResponse.json({ error: "No Stripe subscription found" }, { status: 404 });

    await handleSubscriptionUpdated({
      id: best.id,
      customer: typeof best.customer === "string" ? best.customer : best.customer.id,
      status: best.status,
      current_period_start: best.current_period_start,
      current_period_end: best.current_period_end,
      cancel_at_period_end: best.cancel_at_period_end,
      items: { data: best.items.data.map((i) => ({ price: { id: i.price.id } })) },
    });

    const updated = await db.subscription.findUnique({ where: { organizationId: membership!.organizationId } });
    return NextResponse.json({ success: true, plan: updated?.plan, status: updated?.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
