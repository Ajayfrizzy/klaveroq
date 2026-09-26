import { ApiError } from "./errors";
import { createHash } from "node:crypto";

const keyPattern = /^[A-Za-z0-9._:-]+$/;

export function requireIdempotencyKey(request: Request, maximumLength = 100) {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || key.length > maximumLength || !keyPattern.test(key))
    throw new ApiError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      `Provide an Idempotency-Key header containing at most ${maximumLength} safe characters.`,
    );
  return key;
}

export function scopedIdempotencyKey(scope: string, actorUserId: string, key: string) {
  const value = `${scope}:${actorUserId}:${key}`;
  if (value.length <= 120) return value;
  const digest = createHash("sha256").update(key).digest("hex").slice(0, 48);
  return `${scope}:${actorUserId}:${digest}`;
}
