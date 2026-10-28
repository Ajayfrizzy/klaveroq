# Community beta functional audit

Scope: affordable single-service App Platform beta on `staging`, with `FILE_UPLOADS_ENABLED=false`, disabled identity verification, the existing database and existing auth/email/notification integrations. This audit does not approve a deployment or full production.

## Behavior and regression evidence

| Area | Result | Evidence / limitation |
| --- | --- | --- |
| Upload API enforcement | All five endpoints return 503 `FILE_UPLOADS_DISABLED` before multipart parsing or provider access | `uploads-disabled.test.ts` checks avatars, portfolio media, proof, dispute and support attachments; shared storage entry point also blocks |
| Disabled upload UI | Media upload/removal controls absent; proof/dispute/support file inputs disabled with a future-availability message | Component rendering tests plus browser profile/support checks; text inputs and text-submit controls remain |
| Text profiles and publication | Preserved | Isolated profile integration checks partial edits, completion, publication, ownership and persisted accounts |
| Text/link portfolios | Create/edit preserved without media | Disabled-beta browser regression creates and updates a portfolio entry and renders it |
| Marketplace and agreements | Listing, proposals, messaging and award-to-draft preserved | Marketplace integration verifies transactions, permissions, concurrent proposals, notifications and DRAFT agreement records |
| Support | Ticket creation and text replies preserved | Disabled-beta browser test sends a reply with attachment input disabled |
| Text dispute evidence | JSON notes remain available; multipart is unavailable with uploads disabled | API guard test reaches text-path authentication; UI sends JSON for notes without files. Existing dispute authorization/deadline/transaction logic unchanged |
| Upload data preservation | No switch-triggered SQL, provider writes or deletion | Unit tests assert no database/provider access on rejection; browser snapshots an existing media row/hash/key/status and profile pointer before/after denied uploads and text edits |
| Spaces and ClamAV | Preserved for funded deployments | Existing mocked lifecycle/scanner tests retained; future template/runbook kept separately. No hosted provider acceptance performed |
| Readiness | Explicit low-cost beta may omit Spaces/ClamAV; enabled/unset/invalid switch and full production retain requirements | Policy and readiness-route regression tests. Email/database/HTTPS/security requirements remain |
| Auth and notifications | Password, Google identity linkage, Resend/outbox and protected schedulers retained | Existing auth/email tests, Google-equivalent profile fixture and marketplace notification assertions; live OAuth/Resend delivery remains operator acceptance |
| Identity and financial limitations | Identity disabled; funding/settlement/payout paths not enabled | Beta identity browser test; existing agreement gates unchanged, no PactAgent code/config added |
| Account preferences | PostgreSQL implementation unchanged | Existing unit coverage retained; no preference schema/query changes |

## Verification for this change

- Unit suite: **214 passed across 38 files**.
- Disabled-upload beta production-build browser/integration suite: **4 passed** (identity, marketplace, profile, uploads/text/support/preservation).
- Enabled-upload browser regression: **1 passed**, covering validation, authorization, persistence, replacement and deletion with the switch true.
- Typecheck and both optimized production builds passed. Lint passed with three existing unused-argument warnings in `http/errors.test.ts`. Repository formatting passed after the browser runner restored its temporary TypeScript configuration.
- The beta Playwright run builds the optimized production application before launching its local server.
- All browser data resides in a newly created disposable loopback PostgreSQL database ending in `_test`. Only existing forward migrations were applied to it. No database reset command was used, and the existing beta database was never accessed by these tests.

## Deployment limitations

A previous local filesystem upload is not made durable by preserving its metadata. Back up recoverable bytes before replacing a container; keep metadata and report unavailable content honestly. No automatic deletion/migration or substituted files are introduced. No new schema migration is needed.

The 1 GB runtime has not been load-qualified on App Platform. Native Argon2 costs roughly 64 MiB per concurrent password operation, in addition to Next.js and database connections. Monitor memory, restarts and latency, grow the community gradually and retain secure password settings. A passing local build is not a memory-capacity guarantee.

Remaining acceptance: merged App Platform spec validation, real HTTPS/domain, Google callback, Resend delivery/webhooks, scheduler execution and delays, existing-account/session continuity, redeployment preferences, historical-file inventory and 1 GB load/OOM observations. No deploy, commit, push or merge was performed.
