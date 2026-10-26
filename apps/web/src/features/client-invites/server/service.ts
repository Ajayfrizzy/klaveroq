import { randomBytes } from "node:crypto";
import { and, desc, eq, lte, ne, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  clientInvites,
  notificationDeliveries,
  notifications,
  profiles,
  users,
} from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { enforceAuthRateLimit } from "@/server/auth/rate-limit";
import { ApiError } from "@/server/http/errors";
import { sha256 } from "@/server/http/security";
import { emailDestination, emailTemplate } from "@/server/email/templates";
import { deliverNotificationEmail } from "@/server/email/outbox";
import { audit } from "@/server/audit";
import { invitationLifetime, invitationSchema, invitationStatus, invitationToken } from "./rules";

export async function inviteUser() {
  const current = await requireUser();
  if (current.user.status !== "ACTIVE" || !current.user.emailVerifiedAt)
    throw new ApiError(
      403,
      "VERIFIED_ACCOUNT_REQUIRED",
      "Use an active, verified account to manage invitations.",
    );
  return current;
}
const unavailable = () =>
  new ApiError(
    404,
    "INVITATION_UNAVAILABLE",
    "This invitation is unavailable. Ask the freelancer for a new link.",
  );
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function rateLimit(request: Request, userId: string) {
  // Account-wide quota cannot be bypassed by rotating IP addresses.
  const quotaRequest = new Request(request.url);
  await enforceAuthRateLimit({
    action: "client-invites",
    limit: 20,
    request: quotaRequest,
    subject: userId,
    windowMs: 3_600_000,
  });
  await enforceAuthRateLimit({
    action: "client-invites-ip",
    limit: 50,
    request,
    windowMs: 3_600_000,
  });
}
async function queue(
  tx: Transaction,
  invite: typeof clientInvites.$inferSelect,
  token: string,
  name: string,
) {
  const link = emailDestination(`/client-invites/respond?token=${token}`);
  const email = emailTemplate(
    "You’re invited to Klaveroq",
    `${name} invited you to collaborate on Klaveroq. Sign in with the invited email to review the invitation. This link expires in seven days. Invitations and agreement creation are free.`,
    link,
    "Review invitation",
  );
  const [delivery] = await tx
    .insert(notificationDeliveries)
    .values({
      userId: invite.ownerUserId,
      recipient: invite.email,
      category: "CLIENT_INVITE",
      subject: email.subject,
      textBody: email.text,
      htmlBody: email.html,
      tokenHash: invite.tokenHash,
      expiresAt: invite.expiresAt,
      dedupeKey: `client-invite:${invite.id}:${invite.tokenHash}`,
    })
    .returning();
  return { link, deliveryId: delivery.id };
}
export async function createInvitation(request: Request, raw: unknown) {
  const current = await inviteUser();
  const input = invitationSchema.parse(raw);
  if (input.email === current.user.email.toLowerCase())
    throw new ApiError(400, "SELF_INVITE", "Invite a different email address.");
  await rateLimit(request, current.user.id);
  const token = randomBytes(32).toString("hex");
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${current.user.id}, 0))`);
    const expired = await tx
      .update(clientInvites)
      .set({ status: "EXPIRED", updatedAt: new Date() })
      .where(
        and(
          eq(clientInvites.ownerUserId, current.user.id),
          eq(clientInvites.email, input.email),
          eq(clientInvites.status, "PENDING"),
          lte(clientInvites.expiresAt, new Date()),
        ),
      )
      .returning({ id: clientInvites.id, tokenHash: clientInvites.tokenHash });
    for (const old of expired) {
      await audit(
        request,
        { action: "client_invite.expired", entityType: "client_invite", entityId: old.id },
        tx,
      );
      await tx
        .update(notificationDeliveries)
        .set({ textBody: "", htmlBody: "" })
        .where(eq(notificationDeliveries.tokenHash, old.tokenHash));
    }
    const [invite] = await tx
      .insert(clientInvites)
      .values({
        ...input,
        ownerUserId: current.user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + invitationLifetime),
      })
      .onConflictDoNothing()
      .returning();
    if (!invite)
      throw new ApiError(
        409,
        "INVITATION_EXISTS",
        "A pending invitation already exists. Resend it from your history.",
      );
    const queued = await queue(tx, invite, token, current.profile?.displayName ?? "A freelancer");
    await audit(
      request,
      {
        actorUserId: current.user.id,
        action: "client_invite.created",
        entityType: "client_invite",
        entityId: invite.id,
      },
      tx,
    );
    return { id: invite.id, ...queued };
  });
  const emailQueued = await deliverNotificationEmail(result.deliveryId);
  return { id: result.id, link: result.link, emailQueued };
}
export async function manageInvitation(request: Request, id: string, action: "resend" | "revoke") {
  const current = await inviteUser();
  if (action === "resend") await rateLimit(request, current.user.id);
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${current.user.id}, 0))`);
    const [invite] = await tx
      .select()
      .from(clientInvites)
      .where(and(eq(clientInvites.id, id), eq(clientInvites.ownerUserId, current.user.id)))
      .for("update");
    if (!invite) throw unavailable();
    if (!["PENDING", "EXPIRED"].includes(invitationStatus(invite)))
      throw new ApiError(409, "INVITATION_CLOSED", "This invitation has already been resolved.");
    if (action === "resend") {
      const [pending] = await tx
        .select({ id: clientInvites.id })
        .from(clientInvites)
        .where(
          and(
            eq(clientInvites.ownerUserId, current.user.id),
            eq(clientInvites.email, invite.email),
            eq(clientInvites.status, "PENDING"),
            ne(clientInvites.id, id),
          ),
        );
      if (pending)
        throw new ApiError(
          409,
          "INVITATION_EXISTS",
          "Another pending invitation exists for this client. Use that invitation instead.",
        );
    }
    const token = randomBytes(32).toString("hex");
    const [updated] = await tx
      .update(clientInvites)
      .set(
        action === "revoke"
          ? { status: "REVOKED", updatedAt: new Date() }
          : {
              status: "PENDING",
              tokenHash: sha256(token),
              expiresAt: new Date(Date.now() + invitationLifetime),
              updatedAt: new Date(),
            },
      )
      .where(eq(clientInvites.id, id))
      .returning();
    // Scrub queued old links immediately; in-flight delivery may finish but its token is invalid.
    await tx
      .update(notificationDeliveries)
      .set({
        status: sql`case when ${notificationDeliveries.status} in ('PENDING', 'FAILED', 'PROCESSING') then 'EXPIRED' else ${notificationDeliveries.status} end`,
        textBody: "",
        htmlBody: "",
      })
      .where(eq(notificationDeliveries.tokenHash, invite.tokenHash));
    await audit(
      request,
      {
        actorUserId: current.user.id,
        action: `client_invite.${action === "resend" ? "resent" : "revoked"}`,
        entityType: "client_invite",
        entityId: id,
      },
      tx,
    );
    return action === "resend"
      ? queue(tx, updated, token, current.profile?.displayName ?? "A freelancer")
      : null;
  });
  if (!result) return { revoked: true };
  return { link: result.link, emailQueued: await deliverNotificationEmail(result.deliveryId) };
}
export async function invitationPreview(token: string, email: string) {
  if (!invitationToken.safeParse(token).success) return null;
  const [record] = await db
    .select({ invite: clientInvites, name: profiles.displayName })
    .from(clientInvites)
    .innerJoin(users, eq(users.id, clientInvites.ownerUserId))
    .leftJoin(profiles, eq(profiles.userId, clientInvites.ownerUserId))
    .where(
      and(
        eq(clientInvites.tokenHash, sha256(token)),
        eq(clientInvites.email, email.toLowerCase()),
        eq(users.status, "ACTIVE"),
      ),
    );
  if (!record) return null;
  return {
    id: record.invite.id,
    name: record.name ?? "your freelancer",
    projectTitle: record.invite.projectTitle,
    message: record.invite.message,
    status: invitationStatus(record.invite),
  };
}
export async function respondInvitation(
  request: Request,
  token: string,
  action: "accept" | "decline",
) {
  const { user } = await inviteUser();
  if (!invitationToken.safeParse(token).success) throw unavailable();
  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(clientInvites)
      .where(
        and(
          eq(clientInvites.tokenHash, sha256(token)),
          eq(clientInvites.email, user.email.toLowerCase()),
        ),
      )
      .for("update");
    if (!invite || invite.ownerUserId === user.id) throw unavailable();
    const [owner] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, invite.ownerUserId), eq(users.status, "ACTIVE")));
    if (!owner) throw unavailable();
    if (invitationStatus(invite) !== "PENDING")
      throw new ApiError(
        409,
        "INVITATION_CLOSED",
        "This invitation has expired or has already been resolved.",
      );
    const status = action === "accept" ? "ACCEPTED" : "DECLINED";
    await tx
      .update(clientInvites)
      .set({ status, recipientUserId: user.id, respondedAt: new Date(), updatedAt: new Date() })
      .where(eq(clientInvites.id, invite.id));
    await tx
      .update(notificationDeliveries)
      .set({
        status: sql`case when ${notificationDeliveries.status} in ('PENDING', 'FAILED', 'PROCESSING') then 'EXPIRED' else ${notificationDeliveries.status} end`,
        textBody: "",
        htmlBody: "",
      })
      .where(eq(notificationDeliveries.tokenHash, invite.tokenHash));
    await tx.insert(notifications).values({
      userId: invite.ownerUserId,
      type: `CLIENT_INVITE_${status}`,
      title: `Client invitation ${status.toLowerCase()}`,
      body: "Your client has responded to the invitation.",
      href: "/client-invites",
      dedupeKey: `client-invite-response:${invite.id}`,
    });
    await audit(
      request,
      {
        actorUserId: user.id,
        action: `client_invite.${status.toLowerCase()}`,
        entityType: "client_invite",
        entityId: invite.id,
      },
      tx,
    );
    return { id: invite.id, status };
  });
}
export async function invitationHistory(userId: string) {
  const records = await db
    .select({
      id: clientInvites.id,
      email: clientInvites.email,
      projectTitle: clientInvites.projectTitle,
      status: clientInvites.status,
      expiresAt: clientInvites.expiresAt,
      createdAt: clientInvites.createdAt,
    })
    .from(clientInvites)
    .where(eq(clientInvites.ownerUserId, userId))
    .orderBy(desc(clientInvites.createdAt))
    .limit(100);
  return records.map((record) => ({ ...record, status: invitationStatus(record) }));
}
export async function acceptedInvitations(userId: string) {
  return db
    .select({ id: clientInvites.id, name: profiles.displayName, jobId: clientInvites.jobId })
    .from(clientInvites)
    .leftJoin(profiles, eq(profiles.userId, clientInvites.ownerUserId))
    .where(and(eq(clientInvites.recipientUserId, userId), eq(clientInvites.status, "ACCEPTED")))
    .orderBy(desc(clientInvites.createdAt));
}
export async function invitationAgreement(
  id: string,
  userId: string,
  tx: Transaction | typeof db = db,
) {
  const [invite] = await tx
    .select()
    .from(clientInvites)
    .where(
      and(
        eq(clientInvites.id, id),
        eq(clientInvites.recipientUserId, userId),
        eq(clientInvites.status, "ACCEPTED"),
      ),
    )
    .for("update");
  if (!invite) throw unavailable();
  return invite;
}
