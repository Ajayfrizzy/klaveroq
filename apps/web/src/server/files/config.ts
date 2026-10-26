type Environment = Record<string, string | undefined>;

export type ObjectStorageConfiguration = {
  region: string;
  endpoint: string;
  bucket: string;
  prefix: string;
  credentials: { accessKeyId: string; secretAccessKey: string };
  forcePathStyle?: boolean;
  privateAcl?: boolean;
};

export function s3Configuration(
  environment: Environment = process.env,
): ObjectStorageConfiguration {
  const region = environment.S3_REGION ?? "";
  const endpoint = environment.S3_ENDPOINT ?? "";
  const bucket = environment.S3_BUCKET ?? "";
  const prefix = environment.S3_PREFIX ?? "";
  const accessKeyId = environment.S3_ACCESS_KEY_ID ?? "";
  const secretAccessKey = environment.S3_SECRET_ACCESS_KEY ?? "";
  const forcePathStyle = environment.S3_FORCE_PATH_STYLE ?? "false";
  const privateAcl = environment.S3_PRIVATE_ACL ?? "false";
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("S3 configuration is incomplete or invalid.");
  }
  // Only an explicitly configured HTTPS API origin may receive these credentials.
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(region) ||
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) ||
    bucket.includes("..") ||
    !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\/$/.test(prefix) ||
    !accessKeyId ||
    !secretAccessKey ||
    !["true", "false"].includes(forcePathStyle) ||
    !["true", "false"].includes(privateAcl)
  )
    throw new Error("S3 configuration is incomplete or invalid.");
  return {
    region,
    endpoint: url.origin,
    bucket,
    prefix,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: forcePathStyle === "true",
    privateAcl: privateAcl === "true",
  };
}

export function objectStorageConfiguration(environment: Environment = process.env) {
  if (environment.FILE_STORAGE_BACKEND === "s3") return s3Configuration(environment);
  if (environment.FILE_STORAGE_BACKEND === "spaces") return spacesConfiguration(environment);
  throw new Error("Durable storage required.");
}

export function spacesConfiguration(environment: Environment = process.env) {
  const region = environment.SPACES_REGION ?? "";
  const endpoint = environment.SPACES_ENDPOINT ?? "";
  const bucket = environment.SPACES_BUCKET ?? "";
  const prefix = environment.SPACES_PREFIX ?? "";
  const accessKeyId = environment.SPACES_ACCESS_KEY_ID ?? "";
  const secretAccessKey = environment.SPACES_SECRET_ACCESS_KEY ?? "";
  // Restrict credentials to the regional Spaces API, never a CDN or arbitrary host.
  if (
    !/^[a-z]+\d+$/.test(region) ||
    endpoint !== `https://${region}.digitaloceanspaces.com` ||
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) ||
    !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\/$/.test(prefix) ||
    !accessKeyId ||
    !secretAccessKey
  )
    throw new Error("Spaces configuration is incomplete or invalid.");
  return { region, endpoint, bucket, prefix, credentials: { accessKeyId, secretAccessKey } };
}
