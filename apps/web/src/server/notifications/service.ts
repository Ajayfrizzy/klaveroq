import { createHash } from "node:crypto";
import { and, eq, inArray, lt, lte, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  notificationDeliveries,
  notificationPreferences,
  notifications,
  users,
} from "@/server/db/schema";
import { sendEmail } from "@/server/email";
import { preferenceAllowsEmail, retryDelayMs } from "./policy";
import type { NotificationCategory } from "./policy";

type NotificationInput = {
  userId: string;
  type: string;
  category: NotificationCategory;
  title: string;
  body: string;
  href: string;
  dedupeKey: string;
};

const appUrl = () => process.env.APP_URL ?? "http://127.0.0.1:3000";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
}

export async function deliverNotificationEmail(deliveryId: string) {
  const [delivery] = await db
    .update(notificationDeliveries)
    .set({
      status: "PROCESSING",
      attempts: sql`${notificationDeliveries.attempts} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(notificationDeliveries.id, deliveryId),
        inArray(notificationDeliveries.status, ["PENDING", "FAILED"]),
        lte(notificationDeliveries.nextAttemptAt, new Date()),
        lt(notificationDeliveries.attempts, 5),
      ),
    )
    .returning();
  if (!delivery) return false;
  try {
    await sendEmail({
      to: delivery.recipient,
      subject: delivery.subject,
      text: delivery.textBody,
      html: delivery.htmlBody,
    });
    await db
      .update(notificationDeliveries)
      .set({
        status: "DELIVERED",
        deliveredAt: new Date(),
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(notificationDeliveries.id, delivery.id));
    return true;
  } catch (error) {
    const attempts = delivery.attempts;
    await db
      .update(notificationDeliveries)
      .set({
        status: "FAILED",
        attempts,
        nextAttemptAt: new Date(Date.now() + retryDelayMs(attempts)),
        lastError: error instanceof Error ? error.message.slice(0, 500) : "Email delivery failed.",
        updatedAt: new Date(),
      })
      .where(eq(notificationDeliveries.id, delivery.id));
    return false;
  }
}

export async function retryPendingNotificationEmails(limit = 25) {
  await db
    .update(notificationDeliveries)
    .set({
      status: "FAILED",
      nextAttemptAt: new Date(),
      lastError: "A previous delivery attempt was interrupted.",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(notificationDeliveries.status, "PROCESSING"),
        lte(notificationDeliveries.updatedAt, new Date(Date.now() - 10 * 60 * 1000)),
      ),
    );
  const records = await db
    .select({ id: notificationDeliveries.id })
    .from(notificationDeliveries)
    .where(
      and(
        inArray(notificationDeliveries.status, ["PENDING", "FAILED"]),
        lte(notificationDeliveries.nextAttemptAt, new Date()),
      ),
    )
    .limit(limit);
  return Promise.all(records.map((record) => deliverNotificationEmail(record.id)));
}

export async function notifyUser(input: NotificationInput) {
  const [recipient] = await db
    .select({
      email: users.email,
      preferences: notificationPreferences,
    })
    .from(users)
    .leftJoin(notificationPreferences, eq(notificationPreferences.userId, users.id))
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!recipient) return null;

  const [createdNotification] = await db
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
  const [existingNotification] = createdNotification
    ? [createdNotification]
    : await db
        .select()
        .from(notifications)
        .where(
          and(eq(notifications.userId, input.userId), eq(notifications.dedupeKey, input.dedupeKey)),
        )
        .limit(1);
  const notification = createdNotification ?? existingNotification;
  if (!notification) return null;
  if (!createdNotification) {
    await retryPendingNotificationEmails(10);
    return notification;
  }
  if (!preferenceAllowsEmail(input.category, recipient.preferences)) return notification;

  const destination = new URL(input.href, appUrl()).toString();
  const deliveryDedupeKey = createHash("sha256")
    .update(`${input.userId}:${input.dedupeKey}`)
    .digest("hex");
  const [delivery] = await db
    .insert(notificationDeliveries)
    .values({
      notificationId: notification.id,
      userId: input.userId,
      recipient: recipient.email,
      subject: input.title,
      textBody: `${input.body}\n\nOpen Klaveroq: ${destination}`,
      htmlBody: `<p>${escapeHtml(input.body)}</p><p><a href="${escapeHtml(destination)}">Open Klaveroq</a></p>`,
      dedupeKey: deliveryDedupeKey,
    })
    .onConflictDoNothing()
    .returning({ id: notificationDeliveries.id });
  if (delivery) await deliverNotificationEmail(delivery.id);
  await retryPendingNotificationEmails(10);
  return notification;
}
