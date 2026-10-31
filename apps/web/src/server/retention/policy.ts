import { and, isNotNull, lt, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  authRateLimits,
  notificationDeliveries,
  sessions,
  verificationTokens,
  walletChallenges,
} from "../db/schema";

export const RETENTION_DAYS = {
  expiredSessions: 30,
  consumedOrExpiredTokens: 30,
  walletChallenges: 7,
  authRateLimits: 2,
  deliveredNotificationBodies: 90,
} as const;

// No universal duration is authorized for financial or audit evidence.
export const REVIEW_REQUIRED_RECORDS = ["audit_logs", "agreements", "financial_records"] as const;

const before = (days: number, now: Date) => new Date(now.getTime() - days * 86_400_000);

const mayPurge = (
  owner:
    | typeof sessions.userId
    | typeof verificationTokens.userId
    | typeof walletChallenges.userId
    | typeof notificationDeliveries.userId,
) => sql`not exists(select 1 from account_holds where user_id=${owner} and released_at is null)
 and not exists(select 1 from security_holds where user_id=${owner} and released_at is null and (expires_at is null or expires_at>now()))
 and not exists(select 1 from users where id=${owner} and status in ('SUSPENDED','SECURITY_REVIEW'))`;

export async function enforceShortLivedRetention(now = new Date()) {
  return db.transaction(async (tx) => {
    const deletedSessions = await tx
      .delete(sessions)
      .where(
        and(
          mayPurge(sessions.userId),
          or(
            lt(sessions.expiresAt, before(RETENTION_DAYS.expiredSessions, now)),
            and(
              isNotNull(sessions.revokedAt),
              lt(sessions.revokedAt, before(RETENTION_DAYS.expiredSessions, now)),
            ),
          ),
        ),
      )
      .returning({ id: sessions.id });
    const deletedTokens = await tx
      .delete(verificationTokens)
      .where(
        and(
          mayPurge(verificationTokens.userId),
          or(
            lt(verificationTokens.expiresAt, before(RETENTION_DAYS.consumedOrExpiredTokens, now)),
            and(
              isNotNull(verificationTokens.consumedAt),
              lt(
                verificationTokens.consumedAt,
                before(RETENTION_DAYS.consumedOrExpiredTokens, now),
              ),
            ),
          ),
        ),
      )
      .returning({ id: verificationTokens.id });
    const deletedChallenges = await tx
      .delete(walletChallenges)
      .where(
        and(
          mayPurge(walletChallenges.userId),
          lt(walletChallenges.expiresAt, before(RETENTION_DAYS.walletChallenges, now)),
        ),
      )
      .returning({ id: walletChallenges.id });
    const deletedRateLimits = await tx
      .delete(authRateLimits)
      .where(lt(authRateLimits.updatedAt, before(RETENTION_DAYS.authRateLimits, now)))
      .returning({ action: authRateLimits.action });
    const deletedDeliveries = await tx
      .update(notificationDeliveries)
      .set({ textBody: "", htmlBody: "" })
      .where(
        and(
          mayPurge(notificationDeliveries.userId),
          lt(
            notificationDeliveries.createdAt,
            before(RETENTION_DAYS.deliveredNotificationBodies, now),
          ),
        ),
      )
      .returning({ id: notificationDeliveries.id });
    return {
      sessions: deletedSessions.length,
      tokens: deletedTokens.length,
      walletChallenges: deletedChallenges.length,
      rateLimits: deletedRateLimits.length,
      notificationDeliveries: deletedDeliveries.length,
    };
  });
}
