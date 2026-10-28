# Dashboard render reliability investigation

## Findings and limits

React error **#441** in the installed Next.js/React build is the generic production Server Components error (`resolveErrorProd` in the RSC client). It does not identify a PostgreSQL problem. A digest such as `1899399340` is a correlation clue, not a decoded root cause. No server logs from the original incident were available in this workspace.

The previous dashboard used a single `Promise.all` across **15 operations**. One operation (`getUserFinancialSummary`) issued two concurrent SQL queries, so the initial wave was **16 SQL queries**, plus a preceding session/account query and up to two later milestone/profile enrichment queries. Any rejection from that initial wave rejected the complete page render, including failures in data the page never used.

The existing pool cap is **10 connections per process**, with `prepare: false`. postgres-js queues requests when connections are occupied; exceeding ten submitted queries is not itself an error. The application did not override the driver's connection-establishment timeout (30 seconds by default), and did not configure a SQL statement timeout. A provider/database timeout or connection interruption can still cause a query rejection. Successful health checks only demonstrate a process response and `SELECT 1`/configuration at that moment; they do not test authenticated session joins, table locks, dashboard queries, all pool connections, or an RSC render.

The root layout waits for `connection()` to read the upload switch at request time; it performs no database queries. It is not demonstrated to be the source of this incident. Its failure previously had no custom global boundary. Session retrieval uses a joined session/user/profile query: absent/expired/revoked/suspended sessions return signed-out; a database failure must remain distinct and fail the request.

The old financial summary loads confirmed funding history and this month's releases. Neither those financial results nor five onboarding/history query results were consumed by the current dashboard. They added database work and error dependencies with no visible benefit. The payments page and its financial calculation rules are unchanged; this change neither reports fabricated zero balances nor enables beta payments.

A read-only attempt to inspect timeout settings through the locally configured database URL returned SQLSTATE `XX000` before settings could be retrieved. No private error message or connection URL was logged. This does **not** establish that the deployed service uses the same URL or encountered the same error. Hosted timeout settings, pooler behavior, query timings, connection errors, process restarts and memory use during the original incident remain unverified.

## Demonstrated failure conditions

Tests used a **new isolated loopback PostgreSQL database** with a test-only `statement_timeout=750ms`. No timeout/configuration change was applied to beta, and no beta data was reset, seeded or migrated.

- Holding an exclusive lock on `audit_logs` caused SQLSTATE `57014` on dashboard activity while both health endpoints still returned 200. The new dashboard displayed the activity-unavailable state. Releasing the lock and clicking its Retry recovered the section.
- Locking `wallets` produced an unknown/unavailable verification state, not a false pending/verified value.
- Locking `sessions` or `jobs` caused the critical render to fail while readiness still passed. The new error boundary appeared; releasing the lock and clicking **Retry** re-fetched Server Components and recovered the authenticated dashboard.
- Locking `operations` did not affect the dashboard after removal of the unused financial fetch. The UI retained its beta payment-unavailable message and displayed no invented balance.
- Sixteen concurrent short reads succeeded through a pool capped at ten connections. This disproves “16 operations with max 10 necessarily fails”; it is not a hosted load/capacity benchmark.

These reproduce a plausible failure mechanism matching the health-check observations, **not the historical incident's proven cause**. Intermittent pooler/network issues, provider query limits, contention, memory/restarts on the 1 GB service, deployment/asset mismatch, or a render exception remain possible until an incident is correlated with new diagnostics and platform/database logs.

## Changes

- Session/account retrieval remains essential and is logged as `auth.session` if its database operation fails; a failure is not converted to a signed-out result.
- Core jobs, counts and pending-action reads remain essential. Six core reads run first; up to five enrichment/optional reads follow. The previous unused financial and recommendation-history operations are removed. The pool cap remains ten, with one shared pool per Node process in production as well as development. Multiple app processes/instances would still have separate pools.
- Activity and verification reads degrade only for recognized transient connection/timeout/resource/serialization errors. They return explicit `null` unavailable states. Authentication, permission, schema and unexpected programming errors still propagate. There are no automatic query retries or abandoned `Promise.race` queries consuming pool slots.
- Workspace recommendations show an unavailable state if their existing client-side preference query fails, with a Retry action. PostgreSQL preference persistence is unchanged.
- `error.tsx` and `global-error.tsx` provide a generic message and **Retry** using this installed Next.js version's `retry()` API, which re-fetches RSC data. `reset()` alone would only re-render a potentially failed payload. The global boundary also covers root-layout errors. A plain recovery link can perform a full navigation if the router itself is unhealthy.
- No deployment resources, credentials, upload settings, beta identity/financial restrictions, OAuth, Resend configuration, migrations or user data were changed.

## Diagnostics in platform logs

The existing JSON logger now records `server.render_failure` for named dashboard/session operations and the Next.js `onRequestError` instrumentation hook for unhandled render errors. Records include:

- UTC timestamp, service/event, fixed operation name.
- Fresh server-generated UUID request ID (`x-request-id`, also present on page responses).
- Hashed error fingerprint, numeric Next digest where available, allowlisted error class/database or network code, transient classification.
- Operation elapsed milliseconds (including pool wait and execution) and whether the operation belongs to an optional section.

No raw message, SQL, parameters, database URL, user ID, email, cookies, tokens, query strings, request path or stack is sent by this reporter to logs or the optional existing monitoring webhook. Invalid incoming correlation identifiers are not forwarded; page requests get new server-generated identifiers. Diagnostics are written to platform stderr **before** optional webhook delivery, so an absent/offline receiver does not suppress them. Essential database errors are rethrown as sanitized errors after recording the original fingerprint, preventing Next's default error log from printing their SQL/parameters. Framework log stack frames may remain server-side; the custom boundary never renders an error message or stack supplied by the exception.

Named operation records and `rsc.render` share the same request ID (confirmed during real timeout tests). Framework wrapping/bundling can produce a different fingerprint at the RSC hook, so correlate first by request ID, then digest/time; do not assume the two fingerprints must be identical. Slow essential operations also emit `server.operation_slow` at one second, without account/query data. Logging does not separate pool wait from SQL execution; combine it with provider metrics to locate the delay.

For the next incident, capture the approximate UTC time and page response `x-request-id`, find the corresponding operation/RSC records and digest, then compare provider timeout/connection logs and DigitalOcean restart/OOM graphs. A missing render record during a hard process kill is possible; inspect platform lifecycle logs too. Check the **deployed connection's** `SHOW statement_timeout`, `SHOW lock_timeout` and connection/pooler limits read-only. Do not increase the pool or weaken authentication on the assumption that health checks exclude a render dependency failure.

## Reproducing tests safely

The ordinary beta browser suite now includes `dashboard-smoke.spec.ts`: authenticated initial render, RSC navigation back to the dashboard, and full reload. The existing GitHub Verify browser step runs this via `npm run test:e2e`; the step is explicitly labeled for the authenticated smoke check. Fault tests are excluded from normal suites so table locks cannot interfere with unrelated tests.

To run real timeout/recovery tests locally, use a **new disposable container and database** (adjust the unused host port if necessary):

```sh
docker run --detach --rm --name klaveroq-dashboard-reliability-test \
  --publish 127.0.0.1:55437:5432 \
  --env POSTGRES_DB=klaveroq_dashboard_test \
  --env POSTGRES_USER=klaveroq_test --env POSTGRES_PASSWORD=klaveroq_test \
  postgres:17-alpine -c statement_timeout=750ms

DATABASE_URL=postgresql://klaveroq_test:klaveroq_test@127.0.0.1:55437/klaveroq_dashboard_test \
  npm run db:migrate

TEST_DATABASE_URL=postgresql://klaveroq_test:klaveroq_test@127.0.0.1:55437/klaveroq_dashboard_test \
  node scripts/run-playwright.mjs --config=playwright.dashboard.config.ts

docker stop klaveroq-dashboard-reliability-test
```

Only the new database receives existing migrations; no reset wrapper is needed. Tests reject non-loopback/non-`_test` URLs and require a short statement timeout. Locks are released in `finally`. Do not point this configuration at a shared development database or beta. It uses local test email delivery and disables the optional monitoring webhook.

Final verification results are recorded in `OPERATIONS.md`. The existing 1 GB deployment has not been load-qualified by these tests; capacity and the original hosted root cause remain open operational questions.
