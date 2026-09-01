import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Demo seeder — intentionally a no-op.
 *
 * This used to create a demo user, a Subscription, and fake QUICKBOOKS/HUBSPOT
 * metrics. As an internal tool with real data (and no billing), we do NOT want
 * that demo data injected into the database on every deploy (`postbuild` runs
 * this). It also referenced the removed Subscription model. Left as a no-op so
 * the postbuild step stays valid without writing anything.
 */
async function main() {
  // No seeding for the internal tool.
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
