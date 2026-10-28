import { ccc } from "@ckb-ccc/core";
import { describe, expect, it } from "vitest";
import {
  displayNameFromDocument,
  identityFromRecord,
  vellumClient,
  VellumIdentityError,
} from "./identity";

const CONTROLLER = {
  codeHash: `0x${"11".repeat(32)}`,
  hashType: "type" as const,
  args: `0x${"22".repeat(20)}`,
};

function record(lock = CONTROLLER) {
  return {
    did: "did:ckb:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    cell: { cellOutput: { lock } },
    data: {
      value: {
        document: {
          services: { profile: { type: "VellumProfile", displayName: "Ada Builder" } },
        },
      },
    },
  };
}

describe("Vellum identity configuration", () => {
  it("accepts only a credential-free Testnet RPC URL", () => {
    expect(
      vellumClient({ CKB_NETWORK: "testnet", CKB_RPC_URL: "https://testnet.ckb.dev" }),
    ).toBeInstanceOf(ccc.ClientPublicTestnet);
    expect(() => vellumClient({ CKB_NETWORK: "mainnet" })).toThrow(VellumIdentityError);
    expect(() => vellumClient({ CKB_NETWORK: "testnet" })).toThrow("CKB RPC URL is not configured");
    expect(() =>
      vellumClient({ CKB_NETWORK: "testnet", CKB_RPC_URL: "https://user:pass@example.com" }),
    ).toThrow("CKB RPC URL is invalid");
  });

  it("reads only a bounded Vellum profile display name", () => {
    expect(
      displayNameFromDocument({
        services: { profile: { type: "VellumProfile", displayName: "Ada Builder" } },
      }),
    ).toBe("Ada Builder");
    expect(
      displayNameFromDocument({
        services: { profile: { type: "OtherProfile", displayName: "Untrusted" } },
      }),
    ).toBeUndefined();
    expect(
      displayNameFromDocument({
        services: { profile: { type: "VellumProfile", displayName: "   " } },
      }),
    ).toBeUndefined();
    expect(
      displayNameFromDocument({
        services: { profile: { type: "VellumProfile", displayName: "a".repeat(161) } },
      }),
    ).toBeUndefined();
    expect(
      displayNameFromDocument({
        services: { profile: { type: "VellumProfile", displayName: "Unsafe\u0000name" } },
      }),
    ).toBeUndefined();
  });

  it("accepts only a DID controlled by the selected verified wallet", () => {
    expect(identityFromRecord(record(), "wallet-1", CONTROLLER)).toEqual({
      did: "did:ckb:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      displayName: "Ada Builder",
      walletId: "wallet-1",
    });
    expect(() =>
      identityFromRecord(
        record({ ...CONTROLLER, args: `0x${"33".repeat(20)}` }),
        "wallet-1",
        CONTROLLER,
      ),
    ).toThrow("not controlled by this verified wallet");
  });
});
