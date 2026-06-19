import { db } from "@/server/db";

/**
 * Records a server-side activity event for team usage analytics and a
 * lightweight audit trail. Logging must never break the calling request,
 * so all failures are swallowed.
 */
export async function logActivity(opts: {
  userId: string;
  organizationId: string;
  action: string;
  detail?: string;
  path?: string;
}) {
  try {
    await db.activityLog.create({
      data: {
        userId: opts.userId,
        organizationId: opts.organizationId,
        action: opts.action,
        detail: opts.detail?.slice(0, 500) ?? null,
        path: opts.path?.slice(0, 200) ?? null,
      },
    });
  } catch {
    // Never block on logging failures.
  }
}
