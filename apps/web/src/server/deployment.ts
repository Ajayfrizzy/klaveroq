type DeploymentEnvironment = Record<string, string | undefined>;

export function usesPreviewData(environment: DeploymentEnvironment = process.env) {
  if (environment.KLAVEROQ_PREVIEW_MODE) return environment.KLAVEROQ_PREVIEW_MODE === "1";

  return environment.VERCEL === "1" && !environment.DATABASE_URL;
}
