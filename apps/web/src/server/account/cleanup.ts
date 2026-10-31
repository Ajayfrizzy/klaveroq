import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import { accountClosures, auditLogs, profiles, users } from "../db/schema";
import { log } from "../observability/logger";
import { blockers } from "./service";

// Caller MUST hold the exclusive account mutation gate. No external object deletion
// occurs here: media keys are retained for a separately reviewed storage workflow.
export async function cleanupAccounts(limit = 10) {
  const due = await db
    .select({ id: accountClosures.id, userId: accountClosures.userId })
    .from(accountClosures)
    .where(
      and(
        isNull(accountClosures.processedAt),
        isNull(accountClosures.recoveredAt),
        lte(accountClosures.processAfter, sql`now()`),
        or(isNull(accountClosures.reviewAfter), lte(accountClosures.reviewAfter, sql`now()`)),
      ),
    )
    .orderBy(asc(accountClosures.processAfter))
    .limit(Math.max(1, Math.min(limit, 10)));
  const counts = { processed: 0, deferred: 0, failed: 0 };
  for (const candidate of due) {
    try {
      const outcome = await db.transaction(async (tx) => {
        const [user] = await tx
          .select()
          .from(users)
          .where(eq(users.id, candidate.userId))
          .for("update");
        const [request] = await tx
          .select()
          .from(accountClosures)
          .where(
            and(
              eq(accountClosures.id, candidate.id),
              isNull(accountClosures.processedAt),
              isNull(accountClosures.recoveredAt),
              lte(accountClosures.processAfter, sql`now()`),
            ),
          )
          .for("update");
        if (!user || !request) return "deferred" as const;
        const reasons = await blockers(tx, user.id);
        if (user.status !== "PENDING_DELETION") reasons.push("ACCOUNT_STATE_REVIEW");
        if (reasons.length) {
          await tx
            .update(accountClosures)
            .set({
              retentionReasons: ["ACTIVE_OBLIGATION_OR_HOLD"],
              reviewAfter: sql`now()+interval '1 day'`,
              lastError: "REVIEW_REQUIRED",
            })
            .where(eq(accountClosures.id, request.id));
          await tx.insert(auditLogs).values({
            actorUserId: user.id,
            action: "account.cleanup_deferred",
            entityType: "account_lifecycle",
            entityId: request.id,
          });
          return "deferred" as const;
        }
        const [history] = await tx.execute<{
          financial: boolean;
          shared: boolean;
          sensitive: boolean;
        }>(sql`select
          exists(select 1 from jobs where client_user_id=${user.id} or worker_user_id=${user.id}) or exists(select 1 from operations where initiated_by=${user.id}) or exists(select 1 from wallets where user_id=${user.id}) as financial,
          exists(select 1 from proposals where worker_user_id=${user.id}) or exists(select 1 from job_listings where client_user_id=${user.id}) or exists(select 1 from client_invites where owner_user_id=${user.id} or recipient_user_id=${user.id} or lower(email)=lower(${user.email})) or exists(select 1 from support_tickets where user_id=${user.id}) as shared,
          exists(select 1 from media_files where owner_user_id=${user.id}) or exists(select 1 from identity_verifications where user_id=${user.id}) or exists(select 1 from security_holds where user_id=${user.id}) or exists(select 1 from account_holds where user_id=${user.id}) as sensitive`);
        const retentionReasons = [
          "MINIMAL_AUDIT_ANCHOR",
          ...(history.financial ? ["FINANCIAL_AGREEMENT_REVIEW"] : []),
          ...(history.shared ? ["COUNTERPARTY_RECORD_REVIEW"] : []),
          ...(history.sensitive ? ["SECURITY_IDENTITY_MEDIA_REVIEW"] : []),
        ];
        const status = retentionReasons.length > 1 ? "CLOSED_RETAINED" : "ANONYMIZED";
        await tx
          .update(users)
          .set({
            email: `closed-${user.id}@account.invalid`,
            passwordHash: null,
            emailVerifiedAt: null,
            status,
            failedLoginCount: 0,
            lockedUntil: null,
            lastLoginAt: null,
            updatedAt: sql`now()`,
          })
          .where(eq(users.id, user.id));
        // A private tombstone preserves profile joins and never republishes old data.
        await tx.delete(profiles).where(eq(profiles.userId, user.id));
        await tx
          .insert(profiles)
          .values({ userId: user.id, displayName: "Closed account", isPublic: false });
        await tx.execute(
          sql`update portfolio_items set title='Removed',description='',project_url=null,github_url=null,skills='[]',project_role=null,updated_at=now() where user_id=${user.id}`,
        );
        await tx.execute(
          sql`update media_files set original_name='removed',alt_text='' where owner_user_id=${user.id}`,
        );
        // Only owner-private records; never delete a user, agreement or audit row.
        for (const table of [
          "sessions",
          "verification_tokens",
          "mfa_login_challenges",
          "mfa_methods",
          "auth_identities",
          "wallet_challenges",
          "user_preferences",
          "saved_searches",
          "notification_preferences",
          "proposal_thread_reads",
        ] as const) {
          await tx.execute(sql`delete from ${sql.identifier(table)} where user_id=${user.id}`);
        }
        await tx.execute(
          sql`delete from talent_shortlist_items where user_id=${user.id} or talent_user_id=${user.id}`,
        );
        await tx.execute(
          sql`update notifications set title='Account record',body='',href=null where user_id=${user.id}`,
        );
        await tx.execute(
          sql`update notification_deliveries set recipient='',subject='',text_body='',html_body='',token_hash=null,status=case when status in ('PENDING','FAILED','PROCESSING') then 'SUPPRESSED' else status end where user_id=${user.id}`,
        );
        await tx
          .update(accountClosures)
          .set({
            processedAt: sql`now()`,
            retentionReasons,
            reviewAfter: sql`now()+interval '90 days'`,
            lastError: null,
          })
          .where(eq(accountClosures.id, request.id));
        await tx.insert(auditLogs).values({
          actorUserId: user.id,
          action: "account.cleanup_completed",
          entityType: "account_lifecycle",
          entityId: request.id,
          metadata: { status, retentionReasons },
        });
        return "processed" as const;
      });
      counts[outcome]++;
    } catch {
      counts.failed++;
      await db
        .update(accountClosures)
        .set({ lastError: "CLEANUP_FAILED", reviewAfter: sql`now()+interval '1 hour'` })
        .where(eq(accountClosures.id, candidate.id));
      log.error("account.cleanup_failed", { requestId: candidate.id });
    }
  }
  log.info("account.cleanup_run", counts);
  return counts;
}
