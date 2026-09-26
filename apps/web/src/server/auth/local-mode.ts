type LocalAuthEnvironment = Record<string, string | undefined>;

export function allowsLocalAuthDelivery(environment: LocalAuthEnvironment = process.env) {
  if (environment.NODE_ENV !== "production") return true;
  if (environment.AUTH_EXPOSE_LOCAL_TOKENS !== "1" || !environment.DATABASE_URL) return false;
  try {
    const database = new URL(environment.DATABASE_URL);
    return (
      ["127.0.0.1", "localhost", "::1"].includes(database.hostname) &&
      database.pathname.slice(1).endsWith("_test")
    );
  } catch {
    return false;
  }
}
