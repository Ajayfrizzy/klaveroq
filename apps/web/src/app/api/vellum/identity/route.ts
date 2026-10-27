import { isDidCkb } from "@ckb-ccc/did-ckb";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/server/audit";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { vellumIdentityBindings, wallets } from "@/server/db/schema";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import {
  listControlledIdentities,
  resolveControlledIdentity,
  type VellumIdentityOption,
  vellumClient,
  VellumIdentityError,
} from "@/features/vellum/server/identity";

const bindingInput = z.object({
  did: z.string().max(80).refine(isDidCkb, "The Vellum DID is invalid."),
  walletId: z.string().uuid(),
});

function identityError(error: unknown): never {
  if (error instanceof VellumIdentityError) {
    const unavailable = error.code === "network_unavailable";
    throw new ApiError(
      unavailable ? 503 : 409,
      unavailable ? "VELLUM_NETWORK_UNAVAILABLE" : "VELLUM_IDENTITY_INVALID",
      error.message,
    );
  }
  throw new ApiError(
    503,
    "VELLUM_IDENTITY_LOOKUP_FAILED",
    "Vellum identities could not be verified against CKB Testnet.",
  );
}

function isDuplicateDid(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; constraint_name?: string; cause?: unknown };
  return (
    (record.code === "23505" && record.constraint_name === "vellum_identity_did_unique") ||
    isDuplicateDid(record.cause)
  );
}

export const GET = withApi(async () => {
  const { user } = await requireUser();
  const verifiedWallets = await db
    .select({ id: wallets.id, address: wallets.address, network: wallets.network })
    .from(wallets)
    .where(
      and(
        eq(wallets.userId, user.id),
        eq(wallets.status, "VERIFIED"),
        eq(wallets.network, "testnet"),
      ),
    );

  try {
    return Response.json({ data: await listControlledIdentities(vellumClient(), verifiedWallets) });
  } catch (error) {
    identityError(error);
  }
});

export const PUT = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  const input = bindingInput.parse(await request.json());
  const [wallet] = await db
    .select({ id: wallets.id, address: wallets.address, network: wallets.network })
    .from(wallets)
    .where(
      and(
        eq(wallets.id, input.walletId),
        eq(wallets.userId, user.id),
        eq(wallets.status, "VERIFIED"),
        eq(wallets.network, "testnet"),
      ),
    )
    .limit(1);
  if (!wallet) {
    throw new ApiError(
      409,
      "VELLUM_WALLET_NOT_VERIFIED",
      "Select a verified CKB Testnet wallet controlled by this account.",
    );
  }

  let identity: VellumIdentityOption;
  try {
    identity = await resolveControlledIdentity(vellumClient(), wallet, input.did);
  } catch (error) {
    identityError(error);
  }

  const [existing] = await db
    .select({ userId: vellumIdentityBindings.userId })
    .from(vellumIdentityBindings)
    .where(
      and(eq(vellumIdentityBindings.did, identity.did), ne(vellumIdentityBindings.userId, user.id)),
    )
    .limit(1);
  if (existing) {
    throw new ApiError(
      409,
      "VELLUM_IDENTITY_ALREADY_LINKED",
      "This Vellum DID is already linked to another Klaveroq account.",
    );
  }

  const now = new Date();
  const [binding] = await db
    .insert(vellumIdentityBindings)
    .values({
      userId: user.id,
      walletId: identity.walletId,
      did: identity.did,
      displayName: identity.displayName,
      verifiedAt: now,
    })
    .onConflictDoUpdate({
      target: vellumIdentityBindings.userId,
      set: {
        walletId: identity.walletId,
        did: identity.did,
        displayName: identity.displayName,
        verifiedAt: now,
        updatedAt: now,
      },
    })
    .returning()
    .catch((error: unknown) => {
      if (isDuplicateDid(error)) {
        throw new ApiError(
          409,
          "VELLUM_IDENTITY_ALREADY_LINKED",
          "This Vellum DID is already linked to another Klaveroq account.",
        );
      }
      throw error;
    });

  await audit(request, {
    actorUserId: user.id,
    action: "vellum.identity_linked",
    entityType: "vellum_identity",
    entityId: user.id,
    metadata: { walletId: binding.walletId, network: wallet.network },
  });
  return Response.json({ data: binding });
});
