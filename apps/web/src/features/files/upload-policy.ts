type Environment = Record<string, string | undefined>;

export const UPLOADS_UNAVAILABLE_MESSAGE =
  "File uploads are unavailable during this testing phase. Uploads will become available later. You can still save text and links.";

// Preserve existing development behavior when unset; invalid values fail closed.
export function fileUploadsEnabled(environment: Environment = process.env) {
  return (
    environment.FILE_UPLOADS_ENABLED === undefined || environment.FILE_UPLOADS_ENABLED === "true"
  );
}

export function betaWithoutUploads(environment: Environment = process.env) {
  return (
    environment.NODE_ENV === "production" &&
    environment.DEPLOYMENT_STAGE === "community_beta" &&
    environment.IDENTITY_PROVIDER === "disabled" &&
    environment.IDENTITY_SANDBOX_ENABLED === "0" &&
    environment.FILE_UPLOADS_ENABLED === "false"
  );
}
