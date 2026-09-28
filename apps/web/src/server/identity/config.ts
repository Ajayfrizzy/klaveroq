// Only names backed by implemented, reviewed production adapters belong here.
// There are no production adapters in the community-beta milestone.
export const supportedRealIdentityProviders: readonly string[] = [];
export const deploymentStages = ["development", "community_beta", "production"] as const;
export const betaIdentityDescription =
  "Identity verification will be enabled before Klaveroq's production launch. It is not required to participate in this testing phase.";
export function identityConfiguration(
  environment: Record<string, string | undefined> = process.env,
  realProviders = supportedRealIdentityProviders,
) {
  const stage =
    environment.DEPLOYMENT_STAGE ??
    (environment.NODE_ENV === "production" ? "production" : "development");
  const validStage = (deploymentStages as readonly string[]).includes(stage);
  const provider = environment.IDENTITY_PROVIDER;
  const real = Boolean(provider && realProviders.includes(provider));
  return {
    stage,
    validStage,
    real,
    disabled: provider === "disabled",
    betaDisabled: validStage && stage === "community_beta" && provider === "disabled",
    validProvider: provider === "disabled" || provider === "sandbox" || real,
  };
}
