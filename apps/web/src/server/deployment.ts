type DeploymentEnvironment = Record<string, string | undefined>;

function usesLoopbackDatabase(databaseUrl?: string) {
  if (!databaseUrl) return false;
  try {
    const database = new URL(databaseUrl);
    return ["127.0.0.1", "localhost", "::1"].includes(database.hostname);
  } catch {
    return false;
  }
}

export function allowsIdentitySandbox(environment: DeploymentEnvironment = process.env) {
  if (environment.IDENTITY_PROVIDER !== "sandbox") return false;
  if (!usesLoopbackDatabase(environment.DATABASE_URL)) return false;
  if (environment.NODE_ENV !== "production") return true;
  try {
    const database = new URL(environment.DATABASE_URL ?? "");
    return (
      environment.E2E_TEST_MODE === "1" &&
      environment.IDENTITY_SANDBOX_ENABLED === "1" &&
      database.pathname.slice(1).endsWith("_test")
    );
  } catch {
    return false;
  }
}

export function productionConfigurationIssues(
  environment: DeploymentEnvironment = process.env,
): string[] {
  if (environment.NODE_ENV !== "production" || environment.E2E_TEST_MODE === "1") return [];
  const issues: string[] = [];
  if (!environment.DATABASE_URL) issues.push("database");
  if (!environment.APP_URL?.startsWith("https://")) issues.push("https_app_url");
  if (!environment.SESSION_SECRET || environment.SESSION_SECRET.length < 32)
    issues.push("session_secret");
  if (!environment.MFA_ENCRYPTION_KEY) issues.push("mfa_encryption");
  if (environment.EMAIL_PROVIDER !== "resend" || !environment.RESEND_API_KEY)
    issues.push("email_provider");
  if (!environment.IDENTITY_PROVIDER || environment.IDENTITY_PROVIDER === "sandbox")
    issues.push("identity_provider");
  if (environment.FILE_SCANNER !== "clamav" || !environment.CLAMAV_HOST)
    issues.push("malware_scanner");
  if (!environment.CRON_SECRET || environment.CRON_SECRET.length < 32) issues.push("cron_secret");
  return issues;
}
