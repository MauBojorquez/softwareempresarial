import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { handleSubscriptionUpdated } from "@/server/services/billing/stripe-service";
// In-memory dedup for the current process instance. Falls back gracefully if
// DB check is unavailable — Stripe retries within 24 h so brief duplication is
// acceptable; this guard catches same-second retries that cause duplicate emails.
const recentEvents = new Set<string>();

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = headers().get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: skip already-processed events
  if (recentEvents.has(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }
  recentEvents.add(event.id);
  // Clean up after 10 min to avoid unbounded memory growth
  setTimeout(() => recentEvents.delete(event.id), 10 * 60 * 1000);

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Parameters<typeof handleSubscriptionUpdated>[0];
      await handleSubscriptionUpdated(sub);

      // Send billing emails (fire and forget)
      try {
        const { db } = await import("@/server/db");
        const { sendEmail, billingEmail } = await import("@/server/services/email");
        const stripeCustomerId = typeof sub.customer === "string" ? sub.customer : (sub.customer as { id: string } | null)?.id;
        if (stripeCustomerId) {
          const dbSub = await db.subscription.findUnique({
            where: { stripeCustomerId },
            include: { organization: { include: { memberships: { take: 1, include: { user: true } } } } },
          });
          const adminUser = dbSub?.organization?.memberships?.[0]?.user;
          if (adminUser?.email) {
            const planName = dbSub?.plan ?? "STARTER";
            const emailEvent: Parameters<typeof billingEmail>[1] =
              event.type === "customer.subscription.deleted" ? "canceled" : "upgraded";
            const { subject, html } = billingEmail(adminUser.name ?? "Usuario", emailEvent, planName);
            sendEmail(adminUser.email, subject, html).catch(() => {});
          }
        }
      } catch {}
      break;
    }
  }

  return NextResponse.json({ received: true });
}
