import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./cursor";

describe("opaque pagination cursors", () => {
  it("round trips supported composite values", () => {
    const cursor = {
      kind: "talent-reputation" as const,
      rating: 4.75,
      completed: 12,
      id: "00000000-0000-4000-8000-000000000001",
    };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("rejects malformed, incomplete, and unsupported cursors", () => {
    expect(decodeCursor("not-base64-json")).toBeNull();
    expect(
      decodeCursor(Buffer.from(JSON.stringify({ kind: "unknown" })).toString("base64url")),
    ).toBeNull();
    expect(
      decodeCursor(
        Buffer.from(JSON.stringify({ kind: "listing-budget", value: "10" })).toString("base64url"),
      ),
    ).toBeNull();
  });
});
