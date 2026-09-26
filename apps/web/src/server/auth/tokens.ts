import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { verificationTokens } from "@/server/db/schema";
import { randomToken, sha256 } from "@/server/http/security";

export type AuthTokenPurpose = "VERIFY_EMAIL" | "RESET_PASSWORD";

const lifetimes: Record<AuthTokenPurpose, number> = {
  VERIFY_EMAIL: 24 * 60 * 60_000,
  RESET_PASSWORD: 60 * 60_000,
};

export async function issueAuthToken(userId: string, purpose: AuthTokenPurpose) {
  const token = randomToken();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(verificationTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(verificationTokens.userId, userId),
          eq(verificationTokens.purpose, purpose),
          isNull(verificationTokens.consumedAt),
        ),
      );
    await tx.insert(verificationTokens).values({
      userId,
      purpose,
      tokenHash: sha256(token),
      expiresAt: new Date(now.getTime() + lifetimes[purpose]),
    });
  });
  return token;
}
