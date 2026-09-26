import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/server/audit";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { notifications, securityHolds, wallets } from "@/server/db/schema";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";

export const PATCH = withApi(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    assertSameOrigin(request);
    const { user } = await requireUser();
    const { id } = await context.params;
    const { defaultFor } = z
      .object({ defaultFor: z.enum(["FUNDING", "PAYOUT"]) })
      .parse(await request.json());
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(and(eq(wallets.id, id), eq(wallets.userId, user.id)))
      .limit(1);
    if (!wallet) throw new ApiError(404, "WALLET_NOT_FOUND", "The wallet was not found.");
    if (wallet.status !== "VERIFIED")
      throw new ApiError(409, "WALLET_NOT_VERIFIED", "Only a verified wallet can be selected.");
    if (defaultFor === "FUNDING" && !["FUNDING", "BOTH"].includes(wallet.purpose))
      throw new ApiError(409, "WALLET_PURPOSE_INVALID", "This wallet is not verified for funding.");
    if (defaultFor === "PAYOUT" && !["PAYOUT", "BOTH"].includes(wallet.purpose))
      throw new ApiError(409, "WALLET_PURPOSE_INVALID", "This wallet is not verified for payouts.");

    const defaultColumn =
      defaultFor === "FUNDING" ? wallets.isDefaultFunding : wallets.isDefaultPayout;
    const [existing] = await db
      .select({ id: wallets.id })
      .from(wallets)
      .where(and(eq(wallets.userId, user.id), eq(defaultColumn, true)))
      .limit(1);
    if (existing?.id === wallet.id) return Response.json({ data: wallet, securityHold: null });
    const payoutChange = defaultFor === "PAYOUT" && Boolean(existing);
    const updated = await db.transaction(async (tx) => {
      if (!payoutChange)
        await tx
          .update(wallets)
          .set(
            defaultFor === "FUNDING"
              ? { isDefaultFunding: false, updatedAt: new Date() }
              : { isDefaultPayout: false, updatedAt: new Date() },
          )
          .where(eq(wallets.userId, user.id));
      const [selected] = await tx
        .update(wallets)
        .set({
          ...(defaultFor === "FUNDING" ? { isDefaultFunding: true } : { isDefaultPayout: true }),
          ...(payoutChange ? { status: "LOCKED" as const, isDefaultPayout: false } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(wallets.id, id), eq(wallets.userId, user.id)))
        .returning();
      if (payoutChange)
        await tx.insert(securityHolds).values({
          userId: user.id,
          type: "PAYOUT_WALLET_CHANGE",
          reason: `Default payout wallet change to ${wallet.id}`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
      await tx.insert(notifications).values({
        userId: user.id,
        type: "SECURITY_WALLET_DEFAULT_CHANGED",
        title: `${defaultFor === "FUNDING" ? "Funding" : "Payout"} wallet changed`,
        body: payoutChange
          ? "The new payout wallet will become active after a 24-hour security hold."
          : "Your default wallet selection was updated.",
        href: "/wallet",
      });
      return selected;
    });
    await audit(request, {
      actorUserId: user.id,
      action: "wallet.default_changed",
      entityType: "wallet",
      entityId: wallet.id,
      metadata: { defaultFor, payoutChange },
    });
    return Response.json({
      data: updated,
      securityHold: payoutChange ? { type: "PAYOUT_WALLET_CHANGE", durationHours: 24 } : null,
    });
  },
);

export const DELETE = withApi(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    assertSameOrigin(request);
    const { user } = await requireUser();
    const { id } = await context.params;
    const [revoked] = await db
      .update(wallets)
      .set({
        status: "REVOKED",
        isDefaultFunding: false,
        isDefaultPayout: false,
        replacedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(wallets.id, id), eq(wallets.userId, user.id)))
      .returning();
    if (!revoked) throw new ApiError(404, "WALLET_NOT_FOUND", "The wallet was not found.");
    await Promise.all([
      db.insert(notifications).values({
        userId: user.id,
        type: "SECURITY_WALLET_REVOKED",
        title: "Wallet removed",
        body: `A ${revoked.network} wallet was removed from active use.`,
        href: "/wallet",
      }),
      audit(request, {
        actorUserId: user.id,
        action: "wallet.revoked",
        entityType: "wallet",
        entityId: revoked.id,
        metadata: { network: revoked.network },
      }),
    ]);
    return new Response(null, { status: 204 });
  },
);
