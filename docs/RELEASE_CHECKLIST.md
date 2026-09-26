# Release Checklist

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
