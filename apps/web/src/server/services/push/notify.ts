import { db } from "@/server/db";
import { sendPushToUser } from "./send-push";

type NotifyInput = {
  userId: string;
  title: string;
  message: string;
  type?: string;
  /** Optional URL to open when the push notification is tapped. */
  url?: string;
};

/**
 * Create an in-app notification AND deliver it as a Web Push to all of the
 * user's registered devices. Both steps are best-effort and never throw.
 */
export async function notify({ userId, title, message, type = "info", url }: NotifyInput) {
  try {
    await db.notification.create({
      data: { userId, title, message, type },
    });
  } catch {}

  try {
    await sendPushToUser(userId, { title, body: message, url, tag: type });
  } catch {}
}
