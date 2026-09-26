import { and, isNotNull, lt, or } from "drizzle-orm";
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
  auditLogs: 2557,
  financialAndAgreementRecords: 2557,
} as const;

const before = (days: number, now: Date) => new Date(now.getTime() - days * 86_400_000);

export async function enforceShortLivedRetention(now = new Date()) {
  return db.transaction(async (tx) => {
    const deletedSessions = await tx
      .delete(sessions)
      .where(
        or(
          lt(sessions.expiresAt, before(RETENTION_DAYS.expiredSessions, now)),
          and(
            isNotNull(sessions.revokedAt),
            lt(sessions.revokedAt, before(RETENTION_DAYS.expiredSessions, now)),
          ),
        ),
      )
      .returning({ id: sessions.id });
    const deletedTokens = await tx
      .delete(verificationTokens)
      .where(
        or(
          lt(verificationTokens.expiresAt, before(RETENTION_DAYS.consumedOrExpiredTokens, now)),
          and(
            isNotNull(verificationTokens.consumedAt),
            lt(verificationTokens.consumedAt, before(RETENTION_DAYS.consumedOrExpiredTokens, now)),
          ),
        ),
      )
      .returning({ id: verificationTokens.id });
    const deletedChallenges = await tx
      .delete(walletChallenges)
      .where(lt(walletChallenges.expiresAt, before(RETENTION_DAYS.walletChallenges, now)))
      .returning({ id: walletChallenges.id });
    const deletedRateLimits = await tx
      .delete(authRateLimits)
      .where(lt(authRateLimits.updatedAt, before(RETENTION_DAYS.authRateLimits, now)))
      .returning({ action: authRateLimits.action });
    const deletedDeliveries = await tx
      .delete(notificationDeliveries)
      .where(
        and(
          isNotNull(notificationDeliveries.deliveredAt),
          lt(
            notificationDeliveries.deliveredAt,
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
