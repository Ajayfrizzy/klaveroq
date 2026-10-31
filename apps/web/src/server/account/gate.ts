import postgres from "postgres";
// Separate from the application pool: a waiting gate must not exhaust connections
// needed by handlers holding the gate. All app mutation handlers participate.
const globals = globalThis as typeof globalThis & { accountGateSql?: ReturnType<typeof postgres> };
function client() {
  return (globals.accountGateSql ??= postgres(
    process.env.DATABASE_URL ?? "postgresql://klaveroq:klaveroq_local@127.0.0.1:5433/klaveroq",
    { max: 2, prepare: false },
  ));
}
export async function accountMutationGate<T>(
  exclusive: boolean,
  run: () => Promise<T>,
): Promise<T> {
  let result!: T;
  await client().begin(async (tx) => {
    await tx`set local lock_timeout = '15s'`;
    if (exclusive) await tx`select pg_advisory_xact_lock(72849103)`;
    else await tx`select pg_advisory_xact_lock_shared(72849103)`;
    result = await run();
  });
  return result;
}
export async function gatedRequest<T>(request: Request | undefined, run: () => Promise<T>) {
  if (!request || ["GET", "HEAD", "OPTIONS"].includes(request.method)) return run();
  const path = new URL(request.url).pathname;
  // Reject browser-origin failures before acquiring a database lock. Webhooks and
  // internal workers retain their own signature/bearer authentication.
  if (!path.startsWith("/api/internal/") && !path.startsWith("/api/webhooks/")) {
    const { assertSameOrigin } = await import("../http/security");
    assertSameOrigin(request);
  }
  if (path.startsWith("/api/account/") || path.startsWith("/api/admin/account-")) {
    const { ApiError } = await import("../http/errors");
    if (request.body) {
      const reader = request.clone().body!.getReader();
      let size = 0;
      const deadline = Date.now() + 10_000;
      try {
        while (true) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            const chunk = await Promise.race([
              reader.read(),
              new Promise<never>((_, reject) => {
                timer = setTimeout(
                  () => reject(new ApiError(408, "REQUEST_TIMEOUT", "Please retry your request.")),
                  Math.max(0, deadline - Date.now()),
                );
              }),
            ]);
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > 16_384)
              throw new ApiError(413, "REQUEST_TOO_LARGE", "This account request is too large.");
          } finally {
            clearTimeout(timer);
          }
        }
      } catch (error) {
        // Do not await a tee cancellation while its other branch remains unread.
        void reader.cancel().catch(() => {});
        void request.body.cancel().catch(() => {});
        throw error;
      } finally {
        reader.releaseLock();
      }
    }
  }
  const exclusive =
    path.startsWith("/api/account/") ||
    path.startsWith("/api/admin/account-") ||
    path === "/api/internal/accounts/cleanup";
  return accountMutationGate(exclusive, run);
}
