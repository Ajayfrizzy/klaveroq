type DeploymentEnvironment = Record<string, string | undefined>;

export function usesPreviewData(environment: DeploymentEnvironment = process.env) {
  return (
    environment.NODE_ENV !== "production" &&
    !environment.CI &&
    environment.KLAVEROQ_PREVIEW_MODE === "1"
  );
}
