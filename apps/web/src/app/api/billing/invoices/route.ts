import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { stripe } from "@/lib/stripe";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    include: { organization: { include: { subscription: true } } },
  });

  const customerId = membership?.organization?.subscription?.stripeCustomerId;
  if (!customerId || customerId === "") {
    return NextResponse.json({ invoices: [] });
  }

  try {
    const stripeInvoices = await stripe.invoices.list({
      customer: customerId,
      limit: 12,
    });

    const invoices = stripeInvoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      amount: inv.amount_paid / 100,
      currency: inv.currency.toUpperCase(),
      status: inv.status,
      date: inv.created,
      pdf: inv.invoice_pdf,
      period_start: inv.period_start,
      period_end: inv.period_end,
    }));

    return NextResponse.json({ invoices });
  } catch (err) {
    console.error("Failed to fetch invoices:", err);
    return NextResponse.json({ invoices: [] });
  }
}
