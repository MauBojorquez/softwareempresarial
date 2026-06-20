import webpush from "web-push";
import { db } from "@/server/db";
import { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } from "./vapid";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * Send a web-push notification to every registered device of a user.
 * Stale subscriptions (410/404) are pruned automatically.
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  ensureConfigured();

  let subs: { id: string; endpoint: string; p256dh: string; auth: string }[] = [];
  try {
    subs = await db.pushSubscription.findMany({ where: { userId } });
  } catch {
    return; // table may not exist yet during first deploy
  }
  if (subs.length === 0) return;

  const data = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          data
        );
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    })
  );
}
