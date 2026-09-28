import { createHash } from "node:crypto";
import { and, asc, eq, gt, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  notificationDeliveries as deliveries,
  notificationPreferences,
  verificationTokens,
} from "../db/schema";
import { sendEmail } from ".";
import { EmailProviderError, type EmailMessage } from "./provider";
import {
  preferenceAllowsEmail,
  retryDelayMs,
  type NotificationCategory,
} from "../notifications/policy";
import { log } from "../observability/logger";

export const MAX_EMAIL_ATTEMPTS = 5;
// Resend retains keys for 24h. Stop ambiguous retries before that window closes.
const RETRY_WINDOW_MS = 23 * 60 * 60_000;
const retryable = ["PENDING", "FAILED"];

export async function deliverNotificationEmail(id: string) {
  const now = new Date();
  const [delivery] = await db
    .update(deliveries)
    .set({
      status: "PROCESSING",
      attempts: sql`${deliveries.attempts} + 1`,
      updatedAt: now,
      firstAttemptAt: sql`coalesce(${deliveries.firstAttemptAt}, ${now.toISOString()}::timestamptz)`,
    })
    .where(
      and(
        eq(deliveries.id, id),
        inArray(deliveries.status, retryable),
        lte(deliveries.nextAttemptAt, sql`now()`),
        lt(deliveries.attempts, MAX_EMAIL_ATTEMPTS),
      ),
    )
    .returning();
  if (!delivery) return false;
  const ownership = and(
    eq(deliveries.id, id),
    eq(deliveries.status, "PROCESSING"),
    eq(deliveries.attempts, delivery.attempts),
  );
  async function finish(status: string, extra: Partial<typeof deliveries.$inferInsert> = {}) {
    await db
      .update(deliveries)
      .set({ status, updatedAt: new Date(), ...extra })
      .where(ownership);
    log.info("email.attempt_completed", { deliveryId: id, status, attempt: delivery.attempts });
  }
  try {
    if (
      delivery.firstAttemptAt &&
      now.getTime() - delivery.firstAttemptAt.getTime() >= RETRY_WINDOW_MS
    ) {
      await finish("REVIEW_REQUIRED", { lastError: "IDEMPOTENCY_WINDOW_EXPIRED" });
      return false;
    }
    if (delivery.expiresAt && delivery.expiresAt <= now) {
      await finish("EXPIRED", { textBody: "", htmlBody: "" });
      return false;
    }
    if (delivery.tokenHash) {
      const [token] = await db
        .select({ id: verificationTokens.id })
        .from(verificationTokens)
        .where(
          and(
            eq(verificationTokens.tokenHash, delivery.tokenHash),
            isNull(verificationTokens.consumedAt),
            gt(verificationTokens.expiresAt, now),
          ),
        );
      if (!token) {
        await finish("EXPIRED", { textBody: "", htmlBody: "" });
        return false;
      }
    }
    if (!["SECURITY", "AUTH"].includes(delivery.category)) {
      const [preferences] = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, delivery.userId));
      if (!preferenceAllowsEmail(delivery.category as NotificationCategory, preferences)) {
        await finish("SUPPRESSED");
        return false;
      }
    }
    const receipt = await sendEmail(
      {
        to: delivery.recipient,
        subject: delivery.subject,
        text: delivery.textBody,
        html: delivery.htmlBody,
      },
      `klaveroq/${delivery.dedupeKey}`,
    );
    await finish(receipt.status, {
      providerId: receipt.providerId ?? null,
      acceptedAt: receipt.status === "ACCEPTED" ? new Date() : null,
      deliveredAt: null,
      lastError: null,
      ...(delivery.category === "AUTH" ? { textBody: "", htmlBody: "" } : {}),
    });
    return true;
  } catch (error) {
    const permanent = error instanceof EmailProviderError && error.permanent;
    await finish(
      permanent
        ? "PERMANENT_FAILURE"
        : delivery.attempts >= MAX_EMAIL_ATTEMPTS
          ? "REVIEW_REQUIRED"
          : "FAILED",
      {
        nextAttemptAt: new Date(
          Date.now() +
            Math.max(
              retryDelayMs(delivery.attempts),
              error instanceof EmailProviderError ? error.retryAfterMs : 0,
            ),
        ),
        lastError: error instanceof EmailProviderError ? error.code : "EMAIL_SEND_UNCONFIRMED",
      },
    );
    return false;
  }
}

export async function retryPendingNotificationEmails(limit = 25) {
  // Authentication links must not remain in queued bodies after their lifetime.
  await db
    .update(deliveries)
    .set({ textBody: "", htmlBody: "", updatedAt: new Date() })
    .where(and(eq(deliveries.category, "AUTH"), lte(deliveries.expiresAt, new Date())));
  await db
    .update(deliveries)
    .set({
      status: "FAILED",
      nextAttemptAt: new Date(),
      lastError: "INTERRUPTED_ATTEMPT",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(deliveries.status, "PROCESSING"),
        lte(deliveries.updatedAt, new Date(Date.now() - 10 * 60_000)),
      ),
    );
  await db
    .update(deliveries)
    .set({ status: "REVIEW_REQUIRED", lastError: "RETRY_LIMIT_REACHED", updatedAt: new Date() })
    .where(
      and(
        inArray(deliveries.status, retryable),
        sql`${deliveries.attempts} >= ${MAX_EMAIL_ATTEMPTS}`,
      ),
    );
  const records = await db
    .select({ id: deliveries.id })
    .from(deliveries)
    .where(
      and(
        inArray(deliveries.status, retryable),
        lte(deliveries.nextAttemptAt, new Date()),
        lt(deliveries.attempts, MAX_EMAIL_ATTEMPTS),
      ),
    )
    .orderBy(asc(deliveries.nextAttemptAt), asc(deliveries.id))
    .limit(Math.min(50, Math.max(1, limit)));
  const results: boolean[] = [];
  for (const record of records) results.push(await deliverNotificationEmail(record.id));
  return results;
}

export async function queueAuthEmail(
  email: string,
  token: string,
  purpose: string,
  message: Omit<EmailMessage, "to">,
) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [record] = await db
    .select()
    .from(verificationTokens)
    .where(eq(verificationTokens.tokenHash, tokenHash));
  if (!record) throw new Error("Authentication token is unavailable.");
  const [delivery] = await db
    .insert(deliveries)
    .values({
      userId: record.userId,
      category: "AUTH",
      recipient: email,
      subject: message.subject,
      textBody: message.text,
      htmlBody: message.html,
      tokenHash,
      expiresAt: record.expiresAt,
      dedupeKey: `auth:${purpose}:${tokenHash}`,
    })
    .onConflictDoNothing()
    .returning();
  if (delivery) await deliverNotificationEmail(delivery.id);
  const [result] = await db
    .select({ status: deliveries.status })
    .from(deliveries)
    .where(eq(deliveries.dedupeKey, `auth:${purpose}:${tokenHash}`));
  return result;
}
