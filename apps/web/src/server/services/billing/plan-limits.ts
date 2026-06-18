import { db } from "@/server/db";
import type { Plan } from "@prisma/client";

export const PLAN_LIMITS: Record<Plan, {
  integrations: number;
  users: number;
  aiReportsPerMonth: number;
  categories: string[];
  customDashboards: boolean;
  apiAccess: boolean;
}> = {
  STARTER: {
    integrations: 3,
    users: 3,
    aiReportsPerMonth: 1,
    categories: ["FINANCE", "SALES", "MARKETING"],
    customDashboards: false,
    apiAccess: false,
  },
  PROFESSIONAL: {
    integrations: 10,
    users: 10,
    aiReportsPerMonth: 4,
    categories: ["FINANCE", "SALES", "OPERATIONS", "HR", "MARKETING"],
    customDashboards: true,
    apiAccess: false,
  },
  ENTERPRISE: {
    integrations: 100,
    users: 1000,
    aiReportsPerMonth: 100,
    categories: ["FINANCE", "SALES", "OPERATIONS", "HR", "MARKETING"],
    customDashboards: true,
    apiAccess: true,
  },
};

export async function getSubscriptionForOrg(organizationId: string) {
  const sub = await db.subscription.findUnique({
    where: { organizationId },
  });

  if (!sub || !["ACTIVE", "TRIALING"].includes(sub.status)) {
    return null;
  }

  return sub;
}

export async function checkFeatureAccess(
  organizationId: string,
  feature: keyof typeof PLAN_LIMITS.STARTER
): Promise<{ allowed: boolean; reason?: string; limit?: number; current?: number }> {
  const sub = await getSubscriptionForOrg(organizationId);

  if (!sub) {
    return { allowed: false, reason: "Suscripción activa requerida" };
  }

  const limits = PLAN_LIMITS[sub.plan];

  if (feature === "integrations") {
    const count = await db.integration.count({
      where: { organizationId, isActive: true },
    });
    if (count >= limits.integrations) {
      return { allowed: false, reason: `Plan ${sub.plan} permite máximo ${limits.integrations} integración(es)`, limit: limits.integrations, current: count };
    }
  }

  if (feature === "users") {
    const count = await db.membership.count({ where: { organizationId } });
    if (count >= limits.users) {
      return { allowed: false, reason: `Plan ${sub.plan} permite máximo ${limits.users} usuario(s)`, limit: limits.users, current: count };
    }
  }

  if (feature === "aiReportsPerMonth") {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const count = await db.aIReport.count({
      where: { organizationId, createdAt: { gte: startOfMonth } },
    });
    if (count >= limits.aiReportsPerMonth) {
      return { allowed: false, reason: `Plan ${sub.plan} permite ${limits.aiReportsPerMonth} reporte(s) IA por mes`, limit: limits.aiReportsPerMonth, current: count };
    }
  }

  if (feature === "apiAccess" && !limits.apiAccess) {
    return { allowed: false, reason: "API personalizada disponible en plan Enterprise" };
  }

  if (feature === "customDashboards" && !limits.customDashboards) {
    return { allowed: false, reason: "Dashboards personalizados disponibles desde plan Professional" };
  }

  return { allowed: true };
}

export function canAccessCategory(plan: Plan, category: string): boolean {
  return PLAN_LIMITS[plan].categories.includes(category);
}
