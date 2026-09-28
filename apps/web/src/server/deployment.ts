import { betaWithoutUploads } from "@/features/files/upload-policy";
import { spacesConfiguration } from "./files/config";

type DeploymentEnvironment = Record<string, string | undefined>;
import { emailAppUrl, validEmailSender } from "./email/templates";
import { identityConfiguration } from "./identity/config";

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
  const config = identityConfiguration(environment);
  if (
    !config.validStage ||
    environment.DEPLOYMENT_STAGE === "community_beta" ||
    environment.DEPLOYMENT_STAGE === "production"
  )
    return false;
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
  const issues: string[] = [];
  const identity = identityConfiguration(environment);
  if (!identity.validStage) issues.push("deployment_stage");
  if (!identity.validProvider) issues.push("identity_provider");
  if (
    environment.FILE_UPLOADS_ENABLED !== undefined &&
    !["true", "false"].includes(environment.FILE_UPLOADS_ENABLED)
  )
    issues.push("file_uploads_enabled");
  if (environment.NODE_ENV !== "production") return issues;
  if (
    environment.E2E_TEST_MODE === "1" &&
    (allowsIdentitySandbox(environment) ||
      (identity.betaDisabled &&
        usesLoopbackDatabase(environment.DATABASE_URL) &&
        new URL(environment.DATABASE_URL!).pathname.endsWith("_test")))
  )
    return issues;
  if (identity.stage === "development") issues.push("deployment_stage");
  if (!environment.DATABASE_URL) issues.push("database");
  if (!environment.APP_URL?.startsWith("https://")) issues.push("https_app_url");
  if (!environment.SESSION_SECRET || environment.SESSION_SECRET.length < 32)
    issues.push("session_secret");
  if (!environment.MFA_ENCRYPTION_KEY) issues.push("mfa_encryption");
  if (environment.EMAIL_PROVIDER !== "resend" || !environment.RESEND_API_KEY)
    issues.push("email_provider");
  if (!validEmailSender(environment.EMAIL_FROM)) issues.push("email_sender");
  if (!environment.RESEND_WEBHOOK_SECRET?.startsWith("whsec_")) issues.push("email_webhook");
  try {
    emailAppUrl(environment);
  } catch {
    issues.push("email_app_url");
  }
  if (!identity.betaDisabled && !identity.real && !issues.includes("identity_provider"))
    issues.push("identity_provider");
  if (!betaWithoutUploads(environment)) {
    if (environment.FILE_SCANNER !== "clamav" || !environment.CLAMAV_HOST)
      issues.push("malware_scanner");
    try {
      if (environment.FILE_STORAGE_BACKEND !== "spaces")
        throw new Error("Durable storage required.");
      spacesConfiguration(environment);
    } catch {
      issues.push("file_storage");
    }
    const scannerPort = Number(environment.CLAMAV_PORT ?? 3310);
    if (
      (!Number.isInteger(scannerPort) || scannerPort < 1 || scannerPort > 65535) &&
      !issues.includes("malware_scanner")
    )
      issues.push("malware_scanner");
  }
  if (!environment.CRON_SECRET || environment.CRON_SECRET.length < 32) issues.push("cron_secret");
  return issues;
}
