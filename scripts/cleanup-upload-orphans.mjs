// Run from an authenticated scheduler after reviewing a dry run. No database credentials required.
const appUrl = process.env.APP_URL;
const secret = process.env.CRON_SECRET;
if (!appUrl?.startsWith("https://") || !secret || secret.length < 32)
  throw new Error("HTTPS APP_URL and CRON_SECRET are required.");
const dryRun = !process.argv.includes("--apply");
for (const prefix of ["quarantine/", "clean/"]) {
  let cursor;
  const visited = new Set();
  let pages = 0;
  do {
    const response = await fetch(new URL("/api/internal/files/cleanup", appUrl), {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(300_000),
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ prefix, cursor, dryRun }),
    });
    if (!response.ok) throw new Error(`Cleanup stopped: HTTP ${response.status}`);
    const { data } = await response.json();
    console.log(
      JSON.stringify({
        prefix,
        dryRun,
        scanned: data.scanned,
        candidates: data.candidates,
        deleted: data.deleted,
      }),
    );
    cursor = data.cursor;
    if (cursor && visited.has(cursor)) throw new Error("Cleanup cursor repeated.");
    visited.add(cursor);
    if (++pages > 10_000)
      throw new Error("Cleanup exceeded the page limit; investigate before retrying.");
  } while (cursor);
}
