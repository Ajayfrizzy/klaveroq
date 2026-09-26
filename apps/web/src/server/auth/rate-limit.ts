import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { authRateLimits } from "@/server/db/schema";
import { ApiError } from "@/server/http/errors";
import { clientIpHash, sha256 } from "@/server/http/security";

type RateLimitOptions = {
  action: string;
  limit: number;
  request: Request;
  subject?: string;
  windowMs: number;
};

export async function enforceAuthRateLimit({
  action,
  limit,
  request,
  subject = "",
  windowMs,
}: RateLimitOptions) {
  const now = new Date();
  const boundary = new Date(now.getTime() - windowMs);
  const nowIso = now.toISOString();
  const boundaryIso = boundary.toISOString();
  const keyHash = sha256(`${clientIpHash(request)}:${subject.trim().toLowerCase()}`);
  const [record] = await db
    .insert(authRateLimits)
    .values({ action, keyHash, windowStartedAt: now })
    .onConflictDoUpdate({
      target: [authRateLimits.action, authRateLimits.keyHash],
      set: {
        attempts: sql`case when ${authRateLimits.windowStartedAt} <= ${boundaryIso} then 1 else ${authRateLimits.attempts} + 1 end`,
        windowStartedAt: sql`case when ${authRateLimits.windowStartedAt} <= ${boundaryIso} then ${nowIso} else ${authRateLimits.windowStartedAt} end`,
        updatedAt: now,
      },
    })
    .returning({ attempts: authRateLimits.attempts });
  if (record.attempts > limit)
    throw new ApiError(429, "RATE_LIMITED", "Too many attempts. Wait before trying again.");
}
