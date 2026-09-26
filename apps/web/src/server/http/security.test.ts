import { describe, expect, it } from "vitest";
import { assertSameOrigin } from "./security";

describe("same-origin mutation guard", () => {
  it("accepts the configured origin and read-only requests", () => {
    expect(() =>
      assertSameOrigin(
        new Request("http://127.0.0.1:3000/api/test", {
          method: "POST",
          headers: { origin: "http://127.0.0.1:3000" },
        }),
      ),
    ).not.toThrow();
    expect(() => assertSameOrigin(new Request("http://127.0.0.1:3000/api/test"))).not.toThrow();
  });

  it("rejects mutation requests with a missing or foreign origin", () => {
    expect(() =>
      assertSameOrigin(new Request("http://127.0.0.1:3000/api/test", { method: "POST" })),
    ).toThrow(/origin is not allowed/);
    expect(() =>
      assertSameOrigin(
        new Request("http://127.0.0.1:3000/api/test", {
          method: "POST",
          headers: { origin: "https://attacker.example" },
        }),
      ),
    ).toThrow(/origin is not allowed/);
  });
});
