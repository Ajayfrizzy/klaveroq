import { describe, expect, it } from "vitest";
import { allowsLocalAuthDelivery } from "./local-mode";

describe("local authentication delivery", () => {
  it("is available during local development", () => {
    expect(allowsLocalAuthDelivery({ NODE_ENV: "development" })).toBe(true);
  });

  it("requires an explicit loopback test database in production mode", () => {
    expect(
      allowsLocalAuthDelivery({
        NODE_ENV: "production",
        AUTH_EXPOSE_LOCAL_TOKENS: "1",
        DATABASE_URL: "postgresql://test:test@127.0.0.1:55434/klaveroq_test",
      }),
    ).toBe(true);
    expect(
      allowsLocalAuthDelivery({
        NODE_ENV: "production",
        AUTH_EXPOSE_LOCAL_TOKENS: "1",
        DATABASE_URL: "postgresql://user:secret@db.example.com/klaveroq_test",
      }),
    ).toBe(false);
    expect(
      allowsLocalAuthDelivery({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://test:test@127.0.0.1:55434/klaveroq_test",
      }),
    ).toBe(false);
  });
});
