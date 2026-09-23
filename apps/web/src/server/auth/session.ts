import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "../db";
import { profiles, sessions, users } from "../db/schema";
import { ApiError } from "../http/errors";
import { clientIpHash, randomToken, sha256 } from "../http/security";

export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "klaveroq_session";

export async function createSession(userId: string, request: Request) {
  const token = randomToken();
  const days = Number(process.env.SESSION_TTL_DAYS ?? 30);
  const expiresAt = new Date(Date.now() + days * 86_400_000);
  await db.insert(sessions).values({
    userId,
    tokenHash: sha256(token),
    userAgent: request.headers.get("user-agent"),
    ipHash: clientIpHash(request),
    expiresAt,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
  return expiresAt;
}

export async function revokeCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token)
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.tokenHash, sha256(token)));
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [record] = await db
    .select({ user: users, profile: profiles, sessionId: sessions.id })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, sha256(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!record || ["SUSPENDED", "CLOSED"].includes(record.user.status)) return null;
  return record;
}

export async function requireUser() {
  const current = await getCurrentUser();
  if (!current) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue.");
  return current;
}

export async function requirePaymentsEnabled() {
  const current = await requireUser();
  if (!current.user.emailVerifiedAt)
    throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Verify your email to continue.");
  return current;
}
