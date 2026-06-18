import { stripe, PLANS } from "@/lib/stripe";
import { db } from "@/server/db";
import type { Plan, BillingInterval } from "@prisma/client";

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

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard/overview?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/dashboard/billing`,
    subscription_data: {
      trial_period_days: 14,
    },
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

  await db.subscription.update({
    where: { stripeCustomerId: subscription.customer as string },
    data: {
      stripeSubscriptionId: subscription.id,
      stripePriceId,
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
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
