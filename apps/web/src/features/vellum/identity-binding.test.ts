import { describe, expect, it } from "vitest";
import { isCurrentVellumIdentitySelection } from "./identity-binding";

const binding = {
  did: "did:ckb:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  displayName: "Ada Builder",
  walletId: "11111111-1111-4111-8111-111111111111",
};

describe("Vellum identity selection", () => {
  it("is current only when the DID, wallet, and display name match", () => {
    expect(isCurrentVellumIdentitySelection(binding, binding)).toBe(true);
    expect(
      isCurrentVellumIdentitySelection(binding, { ...binding, displayName: "Ada Updated" }),
    ).toBe(false);
    expect(
      isCurrentVellumIdentitySelection(binding, {
        did: binding.did,
        walletId: binding.walletId,
      }),
    ).toBe(false);
    expect(
      isCurrentVellumIdentitySelection(binding, {
        ...binding,
        walletId: "22222222-2222-4222-8222-222222222222",
      }),
    ).toBe(false);
  });

  it("normalizes an absent option display name to the stored null value", () => {
    expect(
      isCurrentVellumIdentitySelection(
        { ...binding, displayName: null },
        { did: binding.did, walletId: binding.walletId },
      ),
    ).toBe(true);
    expect(isCurrentVellumIdentitySelection(null, binding)).toBe(false);
    expect(isCurrentVellumIdentitySelection(binding, undefined)).toBe(false);
  });
});
