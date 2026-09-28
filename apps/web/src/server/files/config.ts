type Environment = Record<string, string | undefined>;

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
