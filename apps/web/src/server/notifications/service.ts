import { createHash } from "node:crypto";
import { and, asc, eq, isNull, like, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  notificationDeliveries,
  notificationPreferences,
  notifications,
  users,
} from "@/server/db/schema";
import { emailTemplate } from "../email/templates";
import { deliverNotificationEmail } from "../email/outbox";
import { preferenceAllowsEmail, type NotificationCategory } from "./policy";
export { deliverNotificationEmail, retryPendingNotificationEmails } from "../email/outbox";

type NotificationInput = {
  userId: string;
  type: string;
  category: NotificationCategory;
  title: string;
  body: string;
  href: string;
  dedupeKey: string;
};
const summaries: Record<NotificationCategory, string> = {
  PROPOSAL: "There is an update to a marketplace proposal. Sign in to review the details.",
  MESSAGE: "You have a new marketplace message. Sign in to read it securely.",
  JOB: "There is an update to a job, invitation or award. Sign in to review the next action. No funding or settlement is implied.",
  DISPUTE: "There is an update to a dispute. Sign in to review the case securely.",
  SUPPORT: "There is an update to a support case. Sign in to review it securely.",
  SECURITY:
    "An account security setting or sign-in changed. If this was not you, review your signed-in devices and contact support immediately.",
};

export async function notifyUser(input: NotificationInput) {
  const message = emailTemplate(
    input.category === "SECURITY" ? input.title : `Klaveroq ${input.category.toLowerCase()} update`,
    summaries[input.category],
    input.href,
  );
  const result = await db.transaction(async (tx) => {
    const [recipient] = await tx
      .select({ email: users.email, preferences: notificationPreferences })
      .from(users)
      .leftJoin(notificationPreferences, eq(notificationPreferences.userId, users.id))
      .where(eq(users.id, input.userId));
    if (!recipient) return null;
    const [created] = await tx
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href,
        dedupeKey: input.dedupeKey,
      })
      .onConflictDoNothing()
      .returning();
    const [notification] = created
      ? [created]
      : await tx
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, input.userId),
              eq(notifications.dedupeKey, input.dedupeKey),
            ),
          );
    if (!notification) return null;
    const [delivery] = await tx
      .insert(notificationDeliveries)
      .values({
        notificationId: notification.id,
        userId: input.userId,
        category: input.category,
        recipient: recipient.email,
        subject: message.subject,
        textBody: message.text,
        htmlBody: message.html,
        status: preferenceAllowsEmail(input.category, recipient.preferences)
          ? "PENDING"
          : "SUPPRESSED",
        dedupeKey: createHash("sha256").update(`${input.userId}:${input.dedupeKey}`).digest("hex"),
      })
      .onConflictDoNothing()
      .returning();
    return { notification, delivery };
  });
  if (result?.delivery) await deliverNotificationEmail(result.delivery.id);
  return result?.notification ?? null;
}

// Bridge security events committed by auth/wallet transactions without changing OAuth.
export async function enqueueSecurityEmails() {
  const records = await db
    .select({ notification: notifications, email: users.email })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.userId))
    .leftJoin(notificationDeliveries, eq(notificationDeliveries.notificationId, notifications.id))
    .where(
      and(
        like(notifications.type, "SECURITY\\_%"),
        isNull(notificationDeliveries.id),
        sql`${notifications.createdAt} >= (select installed_at from email_delivery_rollout limit 1)`,
      ),
    )
    .orderBy(asc(notifications.createdAt))
    .limit(100);
  for (const { notification, email } of records) {
    const message = emailTemplate(
      notification.title,
      summaries.SECURITY,
      "/wallet",
      "Review account security",
    );
    await db
      .insert(notificationDeliveries)
      .values({
        notificationId: notification.id,
        userId: notification.userId,
        category: "SECURITY",
        recipient: email,
        subject: message.subject,
        textBody: message.text,
        htmlBody: message.html,
        dedupeKey: `security:${notification.id}`,
      })
      .onConflictDoNothing();
  }
  return records.length;
}
