import { describe, expect, it } from "vitest";
import { initialAuthCredentials } from "./defaults";

describe("authentication defaults", () => {
  it("does not prefill customer or administrator credentials", () => {
    expect(initialAuthCredentials()).toEqual({ email: "", password: "" });
  });
});
