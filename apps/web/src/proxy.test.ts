import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

it("replaces supplied correlation data and forwards the same random ID to render and response", () => {
  const response = proxy(
    new NextRequest("https://beta.example/?private=value", {
      headers: { "x-request-id": "personal-token" },
    }),
  );
  const id = response.headers.get("x-request-id");
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  expect(response.headers.get("x-middleware-request-x-request-id")).toBe(id);
  expect(response.headers.get("x-request-id")).not.toBe("personal-token");
});
