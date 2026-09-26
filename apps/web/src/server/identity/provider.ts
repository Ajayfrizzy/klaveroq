import { randomUUID } from "node:crypto";
import { ApiError } from "@/server/http/errors";
import { allowsIdentitySandbox } from "@/server/deployment";

export type IdentityStart = {
  reference: string;
  redirectUrl?: string;
  status: "PENDING" | "VERIFIED";
};
export interface IdentityProvider {
  start(input: { userId: string; email: string; countryCode: string }): Promise<IdentityStart>;
}

class SandboxIdentityProvider implements IdentityProvider {
  async start(input: {
    userId: string;
    email: string;
    countryCode: string;
  }): Promise<IdentityStart> {
    return {
      reference: `sandbox_${randomUUID()}`,
      redirectUrl: `/identity/sandbox?country=${input.countryCode}`,
      status: "PENDING",
    };
  }
}

export function getIdentityProvider(): IdentityProvider {
  if (allowsIdentitySandbox()) return new SandboxIdentityProvider();
  throw new ApiError(
    503,
    "IDENTITY_PROVIDER_UNAVAILABLE",
    "Identity verification is not configured for this environment.",
  );
}
