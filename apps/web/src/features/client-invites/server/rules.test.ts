import { describe, expect, it } from "vitest";
import { invitationLifetime, invitationSchema, invitationStatus, invitationToken } from "./rules";
import { safeReturnTo } from "@/server/auth/google";
describe("client invitation rules", () => {
  it("normalizes email and bounds private text", () => {
    expect(invitationSchema.parse({ email: " Client@Example.test " })).toEqual({
      email: "client@example.test",
      projectTitle: "",
      message: "",
    });
    expect(invitationSchema.safeParse({ email: "bad" }).success).toBe(false);
    expect(
      invitationSchema.safeParse({ email: "a@b.test", message: "a".repeat(2001) }).success,
    ).toBe(false);
  });
  it("expires exactly at the deadline without altering terminal states", () => {
    const expiresAt = new Date(1000);
    expect(invitationStatus({ status: "PENDING", expiresAt }, new Date(999))).toBe("PENDING");
    expect(invitationStatus({ status: "PENDING", expiresAt }, expiresAt)).toBe("EXPIRED");
    for (const status of ["ACCEPTED", "DECLINED", "REVOKED", "EXPIRED"])
      expect(invitationStatus({ status, expiresAt }, new Date(2000))).toBe(status);
    expect(invitationLifetime).toBe(604800000);
  });
  it("rejects malformed tokens and preserves only same-origin auth continuation", () => {
    expect(invitationToken.safeParse("a".repeat(64)).success).toBe(true);
    expect(invitationToken.safeParse("a".repeat(63)).success).toBe(false);
    const path = `/client-invites/respond?token=${"a".repeat(64)}`;
    expect(safeReturnTo(path)).toBe(path);
    expect(safeReturnTo("//evil.example/client-invites")).toBe("/");
  });
});
