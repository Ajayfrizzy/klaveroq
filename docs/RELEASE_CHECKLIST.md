# Release Checklist

## Account preferences and community-beta identity

Verification for this milestone: **149 unit tests passed** across 31 files; **44/44 complete Linux browser/integration tests passed** with snapshot updates disabled; the separate disabled-beta browser/API test passed in Linux and again through its own production-build/server configuration. Production builds for sandbox E2E and disabled beta, typecheck and lint passed (three pre-existing unused-argument lint warnings). The final full run kept application, database and browsers on Linux with isolated temporary uploads after mixed-host tests encountered upload and clock-dependent failures. Existing development databases and credentials were not migrated or changed; the new migration was applied only to newly created isolated test databases. No deployment, commit or push was performed.

Authenticated workspace focus, marketplace saved searches and talent shortlists now use PostgreSQL. Apply migration `0016_panoramic_mister_sinister.sql` through the normal migration command before starting the updated app; never reset an existing database. The three normalized tables enforce allowed focus/scope values, canonical search uniqueness, up to 8 searches per marketplace, and up to 3 distinct non-self shortlist profiles. Concurrent mutations serialize per account and bounded slots enforce caps in the database.

API routes: `GET/PATCH /api/preferences`, `GET/POST/DELETE /api/preferences/saved-searches`, `GET/POST/DELETE /api/preferences/talent-shortlist`, and opt-in `POST /api/preferences/import`. All are session-owned; mutations require same-origin requests, strict validation and audit events. Saved searches persist normalized filters, not external URLs. Comparison loads current public profile data; unavailable entries can be removed.

Legacy account-scoped device keys are inspected only to offer an explicit import when the corresponding server preference is empty. Accepting validates and atomically merges with current account data, preserves an existing server focus and deduplicates collections. Keys are removed only after success and only if unchanged since the prompt. Declining preserves device data and dismisses the prompt for the browser-tab session. Malformed values are ignored. Guest saved searches/shortlists remain device-local; authenticated controls never fall back to device data as authoritative state. Saved searches do not subscribe users to email.

For the hosted community beta, configure:

```env
NODE_ENV=production
DEPLOYMENT_STAGE=community_beta
IDENTITY_PROVIDER=disabled
IDENTITY_SANDBOX_ENABLED=0
```

Do not set `E2E_TEST_MODE` or sandbox secrets on hosted environments. `/api/health/ready` reports `identity: intentionally_disabled_for_beta`; all email, scanner, database, HTTPS and secret requirements still apply. The identity page states that checks are unavailable and not required for beta participation. Start/country/sandbox controls are absent; authenticated starts return 503 `IDENTITY_VERIFICATION_UNAVAILABLE` without inserting a row. Existing records are preserved. Google login, verified email and wallet ownership are not identity verification.

Full production uses `DEPLOYMENT_STAGE=production` and still requires a real implemented identity adapter. **No real identity adapter is implemented in this milestone.** The supported-real-provider registry is deliberately empty: missing, disabled, sandbox and arbitrary provider strings all fail full-production readiness. A policy test exercises a hypothetical registered adapter, but is not evidence of a live provider integration. Integrating, registering and validating signed callbacks/replays/expiry remains a production-only gate. Sandbox is permitted only in guarded local/E2E environments and never in the explicit community-beta or production stage.

Run the regular browser suite plus `node scripts/run-playwright.mjs --config=playwright.beta.config.ts` for the separate disabled-beta server. The `test:e2e` npm command runs both automatically on the disposable test database. For non-destructive local verification, create new isolated databases ending in `_test`, migrate them, and invoke the runner directly instead of the reset wrapper.


Use this checklist for every release candidate. A checked local gate is evidence of application
readiness only; it does not approve production providers or PactAgent operations.

## Required sign-off

| Gate                           | Owner                  | Evidence                                                             | Status                                                |
| ------------------------------ | ---------------------- | -------------------------------------------------------------------- | ----------------------------------------------------- |
| Application checks             | Engineering lead       | CI run URL and commit SHA                                            | Pending CI run                                        |
| Database migration and restore | Database owner         | Migration log and latest restore-drill record                        | Local drill passed; staging pending                   |
| Security and privacy           | Security/privacy owner | Dependency report, audit sample, retention result                    | Local review passed; approval pending                 |
| Accessibility                  | Product/QA owner       | Axe, keyboard, zoom, reduced-motion, and manual screen-reader record | Automated checks passed; manual staging check pending |
| External providers             | Platform owner         | `STAGING_PROVIDER_CHECKLIST.md` evidence                             | Pending configuration                                 |
| Product acceptance             | Product owner          | Critical role journeys and known-limitations acknowledgement         | Pending staging sign-off                              |
| Release decision               | Release manager        | Timestamp, release version, and approver names                       | Pending                                               |

## Automated gates

- [ ] Apply the email outbox migration and complete [Resend live acceptance](EMAIL_DELIVERY.md), including verified sending domain, delivery webhook and one-minute authenticated retry schedule.

- [x] Pull requests and `main` pushes run format, lint, typecheck, unit tests, production build,
      PostgreSQL migrations, and Playwright in `.github/workflows/verify.yml`.
- [x] Chromium covers the complete suite; WebKit covers public discovery and sign-in; Pixel 7
      covers mobile marketplace and profile rendering.
- [ ] Firefox smoke is configured in CI. Record the first successful Ubuntu CI run; the local
      macOS binary failed before navigation because it could not access its generated profile.
- [x] Client, worker, support, dispute-admin, and super-admin workflows have browser coverage.
- [x] Empty, loading, error, permission-denied, expired-session, long-content, mobile, and concurrent
      states have automated coverage.
- [x] Axe serious/critical WCAG A/AA checks, keyboard skip navigation, focus, 200% zoom, and reduced
      motion checks pass locally.
- [ ] Link the successful CI run for the exact release commit: `________________`.

## Performance and recovery evidence

Local warmed baseline on 2026-09-26 used 100 requests per endpoint at concurrency 10 against the
development review server. It produced zero HTTP/network errors: liveness p95 55.8 ms, discovery
p95 256.8 ms, and talent p95 332.4 ms. This is regression evidence, not production capacity proof.

- [ ] Run the same representative read mix plus authenticated mutations in staging with production
      topology. Record p50/p95/p99, throughput, error rate, database saturation, and test data scope.
- [ ] Approve release only with error rate below 1%, public read p95 below 750 ms, and no exhausted
      database or provider pool. Record any approved exception.
- [x] Backup/restore was rehearsed in an isolated local database with representative count checks.
- [ ] Rehearse staging restore, file-object reconciliation, forward-only migration recovery, and
      readiness verification. Attach timestamps and evidence.

## Privacy and claim review

- [x] Logs and audit metadata exclude request bodies, credentials, identity documents, addresses,
      email content, and message content.
- [x] Retention automation is scoped to expired short-lived records; legal-hold and long-lived data
      rules are documented.
- [x] UI copy does not represent local rows as funded, escrowed, released, refunded, or settled.
- [ ] Privacy owner samples staging logs, monitoring events, exports, backups, and provider consoles
      and records approval.
- [ ] Confirm production secrets are held by the deployment secret manager and are absent from
      repository files, CI logs, browser bundles, and screenshots.

## Launch and rollback

Before launch, record the release SHA, migration list, verified backup ID, previous deploy ID,
incident lead, database owner, platform owner, and communication channel.

1. Pause release if CI, readiness, provider, privacy, or role-journey gates fail.
2. For an application-only regression, route traffic to the previous compatible deployment and
   verify `/api/health/live`, `/api/health/ready`, sign-in, and one read-only marketplace journey.
3. For a database migration regression, stop writes and follow `docs/OPERATIONS.md`; restore the
   verified pre-migration backup into a new database rather than editing applied migrations.
4. Disable a failing optional provider at its boundary where supported. Do not fall back to local
   email, sandbox identity, local scanning, or fabricated payment state in production.
5. Preserve request IDs, audit records, deployment logs, and timestamps; declare an incident when
   customer data, authentication, or financial intent may be affected.

Final release sign-off: version `________`, SHA `________`, date `________`, release manager
`________`, product `________`, engineering `________`, security/privacy `________`.
