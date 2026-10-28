// Inject credentials through the scheduler's secret store, never command-line arguments.
const routes = {
  notifications: "/api/internal/notifications/retry",
  retention: "/api/internal/retention/purge",
};
const path = routes[process.argv[2]];
const secret = process.env.CRON_SECRET;
let origin;
try {
  origin = new URL(process.env.APP_URL ?? "");
} catch {
  /* validated below */
}
if (
  !path ||
  !origin ||
  origin.protocol !== "https:" ||
  origin.username ||
  origin.password ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash ||
  !secret ||
  secret.length < 32
) {
  console.error(
    "Configure an HTTPS APP_URL origin, CRON_SECRET and notifications or retention mode.",
  );
  process.exit(1);
}
try {
  const response = await fetch(new URL(path, origin), {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(300_000),
    headers: { authorization: `Bearer ${secret}` },
  });
  // Never log headers, response bodies, URLs, credentials or raw fetch exceptions.
  console.log(`Beta maintenance ${process.argv[2]}: HTTP ${response.status}`);
  if (!response.ok) process.exitCode = 1;
} catch {
  console.error("Beta maintenance request failed; inspect the scheduler and app health.");
  process.exitCode = 1;
}
