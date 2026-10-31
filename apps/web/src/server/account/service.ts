import { getMissingPublicationFields } from "@/features/talent/server/publication";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import {
  accountClosures,
  accountHolds,
  auditLogs,
  mfaMethods,
  notificationDeliveries,
  profiles,
  users,
  verificationTokens,
} from "../db/schema";
import { ApiError } from "../http/errors";
import { randomToken, sha256 } from "../http/security";
import { verifyPassword } from "../auth/password";
import { decryptMfaSecret, verifyTotp } from "../auth/mfa";
import { emailTemplate } from "../email/templates";
import { deliverNotificationEmail } from "../email/outbox";
import { accountCanAuthenticate, recoveryOpen } from "./state";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type User = typeof users.$inferSelect;
export type Credentials = { email: string; password?: string; token?: string; code?: string };
const invalid = () =>
  new ApiError(
    401,
    "REAUTHENTICATION_REQUIRED",
    "Confirm your sign-in details and any enabled two-factor code. Email confirmation links expire after 10 minutes.",
  );
export async function databaseNow(tx: Tx) {
  const [row] = await tx.execute<{ now: Date }>(sql`select now() as now`);
  return new Date(row.now);
}
async function auditEvent(tx: Tx, userId: string, action: string, id?: string, metadata = {}) {
  await tx.insert(auditLogs).values({
    actorUserId: userId,
    action,
    entityType: "account_lifecycle",
    entityId: id ?? userId,
    metadata,
  });
}
export async function hasAccountHold(userId: string) {
  const [row] = await db.execute<{ held: boolean }>(
    sql`select exists(select 1 from account_holds where user_id=${userId} and released_at is null) as held`,
  );
  return row.held;
}
export async function blockers(tx: Tx, userId: string) {
  const [r] = await tx.execute<{
    agreements: boolean;
    operations: boolean;
    disputes: boolean;
    holds: boolean;
    investigations: boolean;
  }>(sql`
    select
      exists(select 1 from jobs where (client_user_id=${userId} or worker_user_id=${userId}) and status not in ('COMPLETED','DECLINED','EXPIRED','CANCELLED','REFUNDED','FAILED'))
      or exists(select 1 from milestones m join jobs j on j.id=m.job_id where (j.client_user_id=${userId} or j.worker_user_id=${userId}) and m.status not in ('RELEASED','REFUNDED','CANCELLED','FAILED')) as agreements,
      exists(select 1 from operations o left join jobs j on j.id=o.job_id where (o.initiated_by=${userId} or j.client_user_id=${userId} or j.worker_user_id=${userId}) and (o.status in ('PENDING','PROCESSING','SECURITY_HOLD') or (o.status='FAILED' and o.type in ('RELEASE','MILESTONE_RELEASE','REFUND','FUND')))) as operations,
      exists(select 1 from disputes d join jobs j on j.id=d.job_id where (d.opened_by=${userId} or j.client_user_id=${userId} or j.worker_user_id=${userId}) and d.status not in ('RESOLVED','CLOSED')) as disputes,
      exists(select 1 from account_holds where user_id=${userId} and released_at is null)
      or exists(select 1 from security_holds where user_id=${userId} and released_at is null and (expires_at is null or expires_at > now())) as holds,
      exists(select 1 from support_tickets where user_id=${userId} and category in ('SECURITY','DISPUTE','PAYMENT') and status not in ('RESOLVED','CLOSED')) as investigations`);
  const labels: Record<keyof typeof r, string> = {
    agreements: "Resolve your active agreements or deliverables before closing your account.",
    operations:
      "A payment or settlement needs review. Contact support before closing your account.",
    disputes: "Resolve your open dispute before closing your account.",
    holds: "Your account requires an authorized review. Contact support for help.",
    investigations: "An open security or payment support case needs review first.",
  };
  return Object.entries(r)
    .filter(([, v]) => v)
    .map(([k]) => labels[k as keyof typeof r]);
}
async function authenticate(
  tx: Tx,
  input: Credentials,
  purpose: "ACCOUNT_DELETE" | "ACCOUNT_RECOVER",
) {
  const [user] = await tx
    .select()
    .from(users)
    .where(sql`lower(${users.email})=${input.email.toLowerCase()}`)
    .for("update");
  if (!user || (user.lockedUntil && user.lockedUntil > (await databaseNow(tx)))) throw invalid();
  let valid = false;
  if (user.passwordHash && input.password)
    valid = await verifyPassword(user.passwordHash, input.password);
  // Email is an alternative only for accounts without a password (e.g. Google).
  if (!user.passwordHash && user.emailVerifiedAt && input.token) {
    const [token] = await tx
      .update(verificationTokens)
      .set({ consumedAt: sql`now()` })
      .where(
        and(
          eq(verificationTokens.userId, user.id),
          eq(verificationTokens.purpose, purpose),
          eq(verificationTokens.tokenHash, sha256(input.token)),
          isNull(verificationTokens.consumedAt),
          gt(verificationTokens.expiresAt, sql`now()`),
        ),
      )
      .returning();
    valid = Boolean(token);
  }
  if (!valid) throw invalid();
  const [method] = await tx
    .select()
    .from(mfaMethods)
    .where(and(eq(mfaMethods.userId, user.id), isNull(mfaMethods.disabledAt)))
    .for("update");
  if (method?.verifiedAt) {
    const code = (input.code ?? "").replaceAll(/[-\s]/g, "").toUpperCase();
    if (!verifyTotp(decryptMfaSecret(method.secretEncrypted), code)) {
      const hash = sha256(code);
      if (!method.recoveryCodeHashes.includes(hash)) throw invalid();
      await tx
        .update(mfaMethods)
        .set({ recoveryCodeHashes: method.recoveryCodeHashes.filter((v) => v !== hash) })
        .where(eq(mfaMethods.userId, user.id));
    }
  }
  return user;
}
async function queueMail(
  tx: Tx,
  user: User,
  title: string,
  body: string,
  key: string,
  href = "/account/recover",
) {
  const message = emailTemplate(title, body, href, "Review account request");
  const [delivery] = await tx
    .insert(notificationDeliveries)
    .values({
      userId: user.id,
      recipient: user.email,
      subject: message.subject,
      textBody: message.text,
      htmlBody: message.html,
      category: "SECURITY",
      dedupeKey: key,
    })
    .onConflictDoNothing()
    .returning();
  return delivery?.id;
}
async function revoke(tx: Tx, id: string) {
  await tx.execute(sql`update sessions set revoked_at=now() where user_id=${id}`);
  await tx.execute(
    sql`update verification_tokens set consumed_at=now() where user_id=${id} and consumed_at is null`,
  );
  await tx.execute(
    sql`update mfa_login_challenges set consumed_at=now() where user_id=${id} and consumed_at is null`,
  );
  await tx.execute(
    sql`update wallet_challenges set consumed_at=now() where user_id=${id} and consumed_at is null`,
  );
}
export async function requestClosure(input: Credentials) {
  const result = await db.transaction(async (tx) => {
    const user = await authenticate(tx, input, "ACCOUNT_DELETE");
    const [existing] = await tx
      .select()
      .from(accountClosures)
      .where(
        and(
          eq(accountClosures.userId, user.id),
          isNull(accountClosures.recoveredAt),
          isNull(accountClosures.processedAt),
        ),
      );
    if (existing && user.status === "PENDING_DELETION")
      return { request: existing, deliveryId: undefined };
    if (!accountCanAuthenticate(user.status) || user.systemRole !== "USER")
      throw new ApiError(
        403,
        "ACCOUNT_UNAVAILABLE",
        "This account requires support review before closure.",
      );
    const reasons = await blockers(tx, user.id);
    if (reasons.length)
      throw new ApiError(409, "CLOSURE_BLOCKED", reasons.join(" "), {
        support: "/account/privacy",
      });
    const [profile] = await tx.select().from(profiles).where(eq(profiles.userId, user.id));
    const [request] = await tx
      .insert(accountClosures)
      .values({
        userId: user.id,
        wasPublic: profile?.isPublic ?? false,
        processAfter: sql`now() + interval '30 days'`,
      })
      .returning();
    await tx
      .update(users)
      .set({ status: "PENDING_DELETION", updatedAt: sql`now()` })
      .where(eq(users.id, user.id));
    await tx
      .update(profiles)
      .set({ isPublic: false, updatedAt: sql`now()` })
      .where(eq(profiles.userId, user.id));
    await tx.execute(
      sql`update job_listings set status='CLOSED', updated_at=now() where client_user_id=${user.id} and status='OPEN'`,
    );
    await tx.execute(
      sql`update proposals set status='WITHDRAWN', updated_at=now() where worker_user_id=${user.id} and status='SUBMITTED'`,
    );
    await tx.execute(
      sql`update client_invites set status='REVOKED', updated_at=now() where owner_user_id=${user.id} and status='PENDING'`,
    );
    await revoke(tx, user.id);
    await auditEvent(tx, user.id, "account.deletion_requested", request.id);
    const deliveryId = await queueMail(
      tx,
      user,
      "Account deletion requested",
      `Your account is hidden and signed out. You can cancel this request by explicitly recovering your account before ${request.processAfter.toISOString()}. After that date, eligible personal data is removed and necessary shared, financial and security records may be retained for review. Logging in does not cancel deletion. If you did not request this, recover your account and contact support immediately.`,
      `closure:${request.id}`,
    );
    return { request, deliveryId };
  });
  if (result.deliveryId) await deliverNotificationEmail(result.deliveryId).catch(() => false);
  return result.request;
}
export async function recoverAccount(input: Credentials) {
  const result = await db.transaction(async (tx) => {
    const user = await authenticate(tx, input, "ACCOUNT_RECOVER");
    const [closure] = await tx
      .select()
      .from(accountClosures)
      .where(
        and(
          eq(accountClosures.userId, user.id),
          isNull(accountClosures.recoveredAt),
          isNull(accountClosures.processedAt),
        ),
      )
      .for("update");
    if (
      user.status !== "PENDING_DELETION" ||
      !closure ||
      !recoveryOpen(closure.processAfter, await databaseNow(tx))
    )
      throw new ApiError(
        409,
        "RECOVERY_UNAVAILABLE",
        "Recovery is unavailable or its 30-day period has ended. Contact privacy support for review.",
      );
    // Recovery does not erase obligations; it restores access to resolve them. Holds still block it.
    const [hold] = await tx.execute<{ held: boolean }>(
      sql`select exists(select 1 from account_holds where user_id=${user.id} and released_at is null) or exists(select 1 from security_holds where user_id=${user.id} and released_at is null and (expires_at is null or expires_at>now())) as held`,
    );
    if (hold.held)
      throw new ApiError(
        403,
        "RECOVERY_REVIEW_REQUIRED",
        "Contact support for an authorized account review.",
      );
    await tx
      .update(users)
      .set({
        status: user.emailVerifiedAt ? "ACTIVE" : "PENDING_EMAIL_VERIFICATION",
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, user.id));
    const [profile] = await tx.select().from(profiles).where(eq(profiles.userId, user.id));
    await tx
      .update(profiles)
      .set({
        isPublic: Boolean(
          closure.wasPublic && profile && !getMissingPublicationFields(profile).length,
        ),
        updatedAt: sql`now()`,
      })
      .where(eq(profiles.userId, user.id));
    await tx
      .update(accountClosures)
      .set({ recoveredAt: sql`now()`, lastError: null })
      .where(eq(accountClosures.id, closure.id));
    await revoke(tx, user.id);
    await auditEvent(tx, user.id, "account.recovered", closure.id);
    return {
      deliveryId: await queueMail(
        tx,
        user,
        "Account recovered",
        "Your deletion request was cancelled. Sign in again to use your account. Closed listings and revoked invitations were not reopened. If this was not you, contact support immediately.",
        `recovery:${closure.id}`,
        "/login",
      ),
    };
  });
  if (result.deliveryId) await deliverNotificationEmail(result.deliveryId).catch(() => false);
}

export async function issueEmailConfirmation(
  email: string,
  action: "delete" | "recover",
  signedInId?: string,
) {
  let localToken: string | undefined;
  const deliveryId = await db.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(users)
      .where(sql`lower(${users.email})=${email.toLowerCase()}`)
      .for("update");
    if (
      !user ||
      user.passwordHash ||
      !user.emailVerifiedAt ||
      (action === "delete" && user.id !== signedInId) ||
      (action === "recover"
        ? user.status !== "PENDING_DELETION"
        : !accountCanAuthenticate(user.status))
    )
      return;
    const purpose = action === "delete" ? "ACCOUNT_DELETE" : "ACCOUNT_RECOVER";
    await tx
      .update(verificationTokens)
      .set({ consumedAt: sql`now()` })
      .where(
        and(
          eq(verificationTokens.userId, user.id),
          eq(verificationTokens.purpose, purpose),
          isNull(verificationTokens.consumedAt),
        ),
      );
    localToken = randomToken();
    await tx.insert(verificationTokens).values({
      userId: user.id,
      purpose,
      tokenHash: sha256(localToken),
      expiresAt: sql`now()+interval '10 minutes'`,
    });
    await auditEvent(tx, user.id, "account.confirmation_requested");
    const id = await queueMail(
      tx,
      user,
      "Confirm your account request",
      "This link confirms your sign-in for the account request you started. It expires in 10 minutes, works once, and still requires your two-factor code if enabled. Opening it alone does not delete or recover your account. If you did not request it, ignore this email.",
      `account-confirm:${sha256(localToken)}`,
      `/account/${action === "delete" ? "settings" : "recover"}?token=${localToken}&email=${encodeURIComponent(user.email)}`,
    );
    if (id)
      await tx
        .update(notificationDeliveries)
        .set({
          category: "AUTH",
          tokenHash: sha256(localToken),
          expiresAt: sql`now()+interval '10 minutes'`,
        })
        .where(eq(notificationDeliveries.id, id));
    return id;
  });
  if (deliveryId) await deliverNotificationEmail(deliveryId).catch(() => false);
  return localToken;
}

export async function setAccountHold(
  actorId: string,
  userId: string,
  reason: string,
  releaseId?: string,
) {
  return db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!user) throw new ApiError(404, "NOT_FOUND", "Account not found.");
    if (releaseId) {
      await tx
        .update(accountHolds)
        .set({ releasedAt: sql`now()`, releasedBy: actorId })
        .where(
          and(
            eq(accountHolds.id, releaseId),
            eq(accountHolds.userId, userId),
            isNull(accountHolds.releasedAt),
          ),
        );
    } else {
      await tx
        .insert(accountHolds)
        .values({ userId, createdBy: actorId, reason, reviewAfter: sql`now()+interval '30 days'` });
      await tx.update(profiles).set({ isPublic: false }).where(eq(profiles.userId, userId));
      await revoke(tx, userId);
    }
    await tx.insert(auditLogs).values({
      actorUserId: actorId,
      action: releaseId ? "account.hold_released" : "account.hold_placed",
      entityType: "user",
      entityId: userId,
    });
  });
}
