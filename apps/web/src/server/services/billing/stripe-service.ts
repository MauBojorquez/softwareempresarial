import { stripe, PLANS } from "@/lib/stripe";
import { db } from "@/server/db";
import type { Plan, BillingInterval } from "@prisma/client";

// Map a Stripe price ID back to the Plan + interval stored in our DB.
function planFromPriceId(priceId: string): { plan: Plan; interval: BillingInterval } | null {
  for (const [planKey, planConfig] of Object.entries(PLANS)) {
    for (const [intervalKey, priceConfig] of Object.entries(planConfig.prices)) {
      if (priceConfig.priceId && priceConfig.priceId === priceId) {
        return { plan: planKey as Plan, interval: intervalKey as BillingInterval };
      }
    }
  }
  return null;
}

export async function createCheckoutSession(
  organizationId: string,
  plan: Plan,
  interval: BillingInterval,
  userEmail: string,
  baseUrl: string
) {
  const planConfig = PLANS[plan];
  const priceId = planConfig.prices[interval].priceId;

  let subscription = await db.subscription.findUnique({
    where: { organizationId },
  });

  let customerId: string;

  if (subscription && subscription.stripeCustomerId && !subscription.stripeCustomerId.startsWith("cus_demo")) {
    customerId = subscription.stripeCustomerId;
  } else {
    const customer = await stripe.customers.create({ email: userEmail });
    customerId = customer.id;
    if (subscription) {
      await db.subscription.update({
        where: { organizationId },
        data: { stripeCustomerId: customerId },
      });
    } else {
      subscription = await db.subscription.create({
        data: {
          organizationId,
          stripeCustomerId: customerId,
          plan,
          interval,
        },
      });
    }
  }

  // If the customer already has an active Stripe subscription, update it in place
  // (Stripe handles proration). This replaces the old plan without creating a new one.
  if (subscription?.stripeSubscriptionId) {
    try {
      const existingSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
      if (existingSub.status !== "canceled") {
        const itemId = existingSub.items.data[0]?.id;
        if (itemId) {
          await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            items: [{ id: itemId, price: priceId }],
            proration_behavior: "always_invoice",
          });
          await db.subscription.update({
            where: { organizationId },
            data: { plan, interval, stripePriceId: priceId },
          });
          return { url: `${baseUrl}/dashboard/billing?upgraded=1` } as any;
        }
      }
    } catch {
      // Sub not found or already canceled — fall through to new checkout.
    }
  }

  // Determine if this customer has ever had a real subscription (used their trial).
  // Trial is only offered on the very first checkout.
  const hasUsedTrial = !!(subscription?.stripeSubscriptionId);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard/overview?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/dashboard/billing`,
    ...(!hasUsedTrial ? { subscription_data: { trial_period_days: 14 } } : {}),
  });

  return session;
}

export async function handleSubscriptionUpdated(subscription: {
  id: string;
  customer: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  items: { data: Array<{ price: { id: string } }> };
}) {
  const stripePriceId = subscription.items.data[0]?.price.id;

  // Resolve the plan and interval from the active price ID so the app
  // immediately reflects an upgrade or downgrade without manual intervention.
  const resolved = stripePriceId ? planFromPriceId(stripePriceId) : null;

  await db.subscription.update({
    where: { stripeCustomerId: subscription.customer as string },
    data: {
      stripeSubscriptionId: subscription.id,
      stripePriceId,
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      // Update plan + interval when Stripe reports a new price (upgrade/downgrade).
      ...(resolved ? { plan: resolved.plan, interval: resolved.interval } : {}),
    },
  });
}

function mapStripeStatus(status: string) {
  const map: Record<string, "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNPAID"> = {
    trialing: "TRIALING",
    active: "ACTIVE",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    unpaid: "UNPAID",
  };
  return map[status] ?? "ACTIVE";
}
