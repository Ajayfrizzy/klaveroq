import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { notifications, securityHolds, walletChallenges, wallets } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin, sha256 } from "@/server/http/security";
import { verifyCkbWallet } from "@/server/wallet/verify";
import { audit } from "@/server/audit";

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  const input = z
    .object({
      challengeId: z.string().uuid(),
      nonce: z.string().min(20),
      signature: z.string().min(20),
      publicKey: z.string().min(20),
      purpose: z.enum(["FUNDING", "PAYOUT", "BOTH"]),
    })
    .parse(await request.json());
  const [challenge] = await db
    .select()
    .from(walletChallenges)
    .where(
      and(
        eq(walletChallenges.id, input.challengeId),
        eq(walletChallenges.userId, user.id),
        eq(walletChallenges.nonceHash, sha256(input.nonce)),
        isNull(walletChallenges.consumedAt),
        gt(walletChallenges.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!challenge)
    throw new ApiError(
      400,
      "WALLET_CHALLENGE_INVALID",
      "The wallet challenge is invalid, expired, or already used.",
    );
  const valid = await verifyCkbWallet({
    message: challenge.message,
    signature: input.signature,
    publicKey: input.publicKey,
    address: challenge.address,
    network: challenge.network as "mainnet" | "testnet",
  });
  if (!valid)
    throw new ApiError(
      400,
      "WALLET_SIGNATURE_INVALID",
      "The wallet signature does not match the claimed address.",
    );
  const wantsPayout = ["PAYOUT", "BOTH"].includes(input.purpose);
  const [currentPayout] = wantsPayout
    ? await db
        .select()
        .from(wallets)
        .where(
          and(
            eq(wallets.userId, user.id),
            eq(wallets.isDefaultPayout, true),
            eq(wallets.status, "VERIFIED"),
          ),
        )
        .limit(1)
    : [];
  const payoutChange = Boolean(currentPayout && currentPayout.address !== challenge.address);
  const result = await db.transaction(async (tx) => {
    await tx
      .update(walletChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(walletChallenges.id, challenge.id));
    if (["FUNDING", "BOTH"].includes(input.purpose))
      await tx
        .update(wallets)
        .set({ isDefaultFunding: false, updatedAt: new Date() })
        .where(eq(wallets.userId, user.id));
    if (wantsPayout && !payoutChange)
      await tx
        .update(wallets)
        .set({ isDefaultPayout: false, updatedAt: new Date() })
        .where(eq(wallets.userId, user.id));
    const [wallet] = await tx
      .insert(wallets)
      .values({
        userId: user.id,
        network: challenge.network,
        address: challenge.address,
        purpose: input.purpose,
        status: payoutChange ? "LOCKED" : "VERIFIED",
        isDefaultFunding: ["FUNDING", "BOTH"].includes(input.purpose),
        isDefaultPayout: wantsPayout && !payoutChange,
        verifiedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [wallets.userId, wallets.network, wallets.address],
        set: {
          purpose: input.purpose,
          status: payoutChange ? "LOCKED" : "VERIFIED",
          isDefaultFunding: ["FUNDING", "BOTH"].includes(input.purpose),
          isDefaultPayout: wantsPayout && !payoutChange,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        },
      })
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
      type: "SECURITY_WALLET_VERIFIED",
      title: "Wallet ownership verified",
      body: payoutChange
        ? "Your payout wallet change is in a 24-hour security hold."
        : `A ${challenge.network} wallet was verified for your account.`,
      href: "/wallet",
    });
    return wallet;
  });
  await audit(request, {
    actorUserId: user.id,
    action: "wallet.verified",
    entityType: "wallet",
    entityId: result.id,
    metadata: { network: result.network, purpose: result.purpose, payoutChange },
  });
  return Response.json({
    data: result,
    securityHold: payoutChange ? { type: "PAYOUT_WALLET_CHANGE", durationHours: 24 } : null,
  });
});
