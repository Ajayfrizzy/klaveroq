import { z } from "zod";
import { db } from "@/server/db";
import { walletChallenges } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { withApi } from "@/server/http/errors";
import { assertSameOrigin, randomToken, sha256 } from "@/server/http/security";
import { audit } from "@/server/audit";

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  const input = z
    .object({ address: z.string().min(20).max(300), network: z.enum(["mainnet", "testnet"]) })
    .parse(await request.json());
  const nonce = randomToken(24);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 10 * 60_000);
  const message = [
    `Klaveroq wallet verification`,
    `Address: ${input.address}`,
    `Network: CKB ${input.network}`,
    `Nonce: ${nonce}`,
    `Issued at: ${issuedAt.toISOString()}`,
    `Expires at: ${expiresAt.toISOString()}`,
    `Signing verifies wallet ownership and does not authorize a payment.`,
  ].join("\n");
  const [challenge] = await db
    .insert(walletChallenges)
    .values({
      userId: user.id,
      network: input.network,
      address: input.address,
      nonceHash: sha256(nonce),
      message,
      expiresAt,
    })
    .returning();
  await audit(request, {
    actorUserId: user.id,
    action: "wallet.challenge_created",
    entityType: "wallet_challenge",
    entityId: challenge.id,
    metadata: { network: input.network },
  });
  return Response.json({ data: { id: challenge.id, message, nonce, expiresAt } }, { status: 201 });
});
