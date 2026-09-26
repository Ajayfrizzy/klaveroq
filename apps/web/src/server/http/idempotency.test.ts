import { describe, expect, it } from "vitest";
import { requireIdempotencyKey, scopedIdempotencyKey } from "./idempotency";

describe("idempotency keys", () => {
  it("accepts bounded opaque keys and scopes them to an actor and operation", () => {
    const request = new Request("https://example.test", {
      headers: { "Idempotency-Key": "retry_123:attempt-1" },
    });
    const key = requireIdempotencyKey(request);
    expect(scopedIdempotencyKey("create-listing", "user-1", key)).toBe(
      "create-listing:user-1:retry_123:attempt-1",
    );
  });

  it("rejects missing, oversized, or unsafe values", () => {
    expect(() => requireIdempotencyKey(new Request("https://example.test"))).toThrow();
    expect(() =>
      requireIdempotencyKey(
        new Request("https://example.test", { headers: { "Idempotency-Key": "space key" } }),
      ),
    ).toThrow();
    expect(() =>
      requireIdempotencyKey(
        new Request("https://example.test", { headers: { "Idempotency-Key": "x".repeat(101) } }),
      ),
    ).toThrow();
  });

  it("hashes otherwise valid keys when the scoped database value would exceed its column", () => {
    const scoped = scopedIdempotencyKey(
      "support-admin-message",
      crypto.randomUUID(),
      "x".repeat(100),
    );
    expect(scoped.length).toBeLessThanOrEqual(120);
    expect(scoped).not.toContain("x".repeat(100));
  });
});
