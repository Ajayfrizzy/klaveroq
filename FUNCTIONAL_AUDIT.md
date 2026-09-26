# Klaveroq Functional Audit

Audit date: 2026-09-26

Milestone: standalone marketplace, before PactAgent integration

## UI/UX phases — September 26, 2026

Implemented the four UI/UX phases documented in `IMPLEMENTATION_PHASES.md`: unified signed-in navigation, complete public mobile navigation, compact discovery filters and actionable empty states; role-aware dashboard and agreement guidance; guided profiles, unsaved-work protection and recoverable form errors; local shortlists, current-data comparison, saved searches, and timezone context; improved type, contrast, touch targets, and keyboard behavior.

Validation: lint, TypeScript, production builds, and 111 unit tests pass. Chromium, mobile, and WebKit regression coverage exercised 34 scenarios; the sole initial wizard-contrast failure was fixed and passed in the subsequent 10-test UI/UX/agreement run. Public and authenticated axe checks cover jobs, wallet, notifications, support, profile editing, comparison, invalid forms, and agreement detail. Test fixtures were created only in the disposable local test database.

Local preferences/searches/shortlists are explicitly device-local and account-scoped. Comparisons fetch current public profiles and handle revoked publication. Unsaved form content remains in memory with link-navigation and browser-unload warnings; no autosave or cross-device draft recovery is claimed. PactAgent funding and settlement remain unavailable.

## Status legend

- **Implemented and tested**: the expected observable result was exercised against a disposable local PostgreSQL database.
- **Implemented, code-traced**: UI, authorization, validation, database operation, and result rendering exist, but the complete browser workflow was not exercised in this audit.
- **Partial**: useful behavior exists, but an advertised workflow is incomplete or only available through an API.
- **UI-only / inactive**: no authoritative operation exists behind the control.
- **PactAgent-blocked**: must not be represented as operational until the external integration and reconciliation are implemented.

## Executive findings

- [x] Runtime marketplace pages read PostgreSQL through Drizzle. All unused runtime fixture modules, preview-mode configuration, and the demonstration seeder have been removed.
- [x] The loopback development database contains zero exact legacy demo users, demo jobs, jobs, or listings. Its one existing non-demo account was preserved.
- [x] Google authentication code and credentials were preserved; mocked provider claims cover valid and invalid identities. Real-Google browser verification remains manual.
- [x] Fresh private profiles can now be saved incrementally. Editing and publishing use separate validation rules, with field-level errors and an explicit private fallback for incomplete published profiles.
- [x] Profile persistence, failed-save input retention, portfolio create/edit/delete, public profile visibility, logout/repeat sign-in, Jobs filtering, support submission/retrieval, and wallet empty/stored-record states passed isolated browser or HTTP workflow tests.
- [x] Wallet, identity, session, and MFA controls now use signed-in user records and tested server mutations. No blockchain balance or payment capability is inferred from a wallet ownership record.
- [x] The signed-in Jobs search and status filter now submit URL parameters and constrain an authorized database query.
- [x] PactAgent/Mainnet operational copy was removed from the shell, dashboard, direct-job flow, job detail, talent invitation, discovery copy, and metadata.
- [x] Inert notification preferences are explicitly disabled. Placeholder support-guide links are now non-interactive labels.
- [x] Public listing draft persistence, reload/edit/publish, filtered discovery, proposals, participant-only messaging, shortlist, concurrent award, notifications, and persistent agreement-draft creation passed a real multi-account Playwright run against disposable PostgreSQL.
- [x] Agreement detail now displays both participants, terms, milestones, proof/review controls for valid in-progress states, cancellation and dispute controls, and explicit pre-funding/PactAgent gates.
- [x] Direct invitations are restricted to existing Klaveroq accounts and create a linked recipient notification. Unknown-email invitations return `ACCOUNT_NOT_FOUND` and create no invitation.
- [x] Every state-changing API route now emits a correlated privacy-safe audit event, enforced by an automated source-level coverage test.
- [x] API responses expose safe request IDs; structured logs, optional error monitoring, liveness/readiness routes, production configuration checks, and security headers are implemented.
- [x] Short-lived security/delivery retention is enforced by an authenticated scheduled route. Long-lived evidence, legal-hold, account-closure, recovery, incident, and secret-rotation procedures are documented.
- [x] A disposable backup/restore drill reproduced user, audit, listing, operation, and migration counts exactly. Critical/high production dependency advisories were resolved.
- [x] Phase 8 CI, cross-browser smoke projects, accessibility checks, super-admin/session/failure-state coverage, load evidence, and release/provider checklists are implemented locally.
- [ ] Payment funding, escrow balances, releases, refunds, settlement, and blockchain reconciliation are not implemented. Database statuses and timestamps are not proof of an on-chain operation.

## Customer-facing feature audit

| Feature                             | Actual status                          | UI -> authorization -> data -> observable result                                                                                                          | Missing behavior / required test                                                                                                                                     | Primary files                                                                                                                  |
| ----------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Password login                      | Implemented and tested                 | Login form -> rate limit, same-origin check, password verification, lockout checks -> `sessions` insert and cookie -> redirect                            | Real hosted cookie expiry remains a staging check                                                                                                                    | `features/auth/components/auth-form.tsx`, `api/auth/login/route.ts`, `server/auth/session.ts`                                  |
| Registration                        | Implemented; delivery staging pending  | Register form -> rate limit -> validated user/profile/token inserts -> session -> provider email -> verification/resend screen                            | Configure Resend and verify real hosted mail receipt before release                                                                                                  | `auth-form.tsx`, `api/auth/register/route.ts`, `api/auth/verify-email/**`, `server/email/**`                                   |
| Google sign-in                      | Mock-tested; real browser test pending | Google start/callback -> state, nonce, issuer/audience/email checks -> user/identity/profile/session upsert -> redirect                                   | Complete the documented real-provider repeat-login, logout, persistence, and restart checks before release                                                           | `api/auth/google/route.ts`, `api/auth/google/callback/route.ts`, `server/auth/google.ts`                                       |
| Password reset                      | Implemented and browser-tested         | Generic request screen -> rate-limited token replacement/provider email -> reset screen -> atomic consumption, password update, session revocation        | Configure Resend and verify real hosted mail receipt before release                                                                                                  | `app/forgot-password`, `app/reset-password`, `api/auth/password/**`, `server/email/**`                                         |
| Dashboard                           | Implemented, code-traced               | Authenticated page -> participant-scoped jobs, actions, verification records, confirmed-operation aggregates -> cards/lists                               | Payment balance remains explicitly unavailable. Add page-level database tests and browser checks for each role/state                                                 | `app/page.tsx`, `features/dashboard/server/queries.ts`, `metrics.ts`, `onboarding.ts`                                          |
| Global navigation                   | Implemented and tested                 | Sidebar, top bar, mobile menu, and marketplace header destinations all resolve to existing pages; nested routes retain active context and `aria-current`  | Marketplace header is server-rendered without active-route styling                                                                                                   | `components/layout/app-shell.tsx`, `features/marketplace/components/marketplace-header.tsx`                                    |
| Find Work search/filter/sort        | Implemented and browser-tested         | GET form -> validated filters and opaque composite cursor -> open, unexpired listings -> stable bounded page                                              | Add production search-vector/trigram indexing if measured text-search latency exceeds the release threshold                                                          | `app/discover/page.tsx`, `marketplace/server/queries.ts`, `marketplace/server/schemas.ts`                                      |
| Listing detail                      | Implemented and browser-tested         | Public ID -> open/closed/awarded listing, milestones, client public data, derived reputation -> detail page                                               | Policy confirmed: closed and awarded history remains public; drafts/cancelled listings remain owner-only and are not publicly rendered                               | `app/discover/[id]/page.tsx`, `marketplace/server/queries.ts`                                                                  |
| Proposal create/edit/withdraw       | Implemented and tested                 | Composer -> eligibility and ownership checks -> proposals and proposal milestones transaction -> refreshed UI                                             | AI drafting uses a deterministic template provider and must remain labeled as editable draft assistance                                                              | `proposal-composer.tsx`, `api/marketplace/listings/[id]/proposals/route.ts`, `api/marketplace/listings/[id]/proposal/route.ts` |
| Proposal messages                   | Implemented and browser-tested         | Participant-only thread -> idempotency/rate limit -> message, read cursor, notification/outbox -> unread badge and refreshed thread                       | Real Resend receipt remains a staging configuration check                                                                                                            | `proposal-thread.tsx`, `marketplace/server/unread.ts`, `api/marketplace/proposals/[id]/messages/route.ts`                      |
| Client proposal evaluation          | Implemented and browser-tested         | Listing owner sees sealed proposals with batch-loaded milestones -> shortlist/reject/award endpoints -> transactional updates and notifications           | Award creates a `DRAFT` job only, not funding                                                                                                                        | `client-proposals.tsx`, `api/marketplace/proposals/[id]/{shortlist,reject,award}/route.ts`                                     |
| Find Talent                         | Implemented and browser-tested         | SQL filters/ranks all public profiles by current reputation/completed work/recent update -> opaque cursor page -> portfolio previews and cards            | Move aggregates to maintained summary rows if production measurements show full aggregate recomputation exceeds the release threshold                                | `app/talent/page.tsx`, `features/talent/server/queries.ts`, `schemas.ts`                                                       |
| Public talent profile               | Implemented and tested                 | Public/owner authorization -> sanitized profile, portfolio, completed-work metrics -> public page                                                         | External portfolio URLs are user supplied; retain safe protocol validation and add UI accessibility checks                                                           | `app/talent/[userId]/page.tsx`, `talent/server/public-profile.ts`, `authorization.ts`                                          |
| Profile editing                     | Implemented and browser-tested         | Owner form -> validated profile/avatar mutations -> quarantine and scan -> owner rows and audit -> immediate and refreshed result                         | Configure and exercise ClamAV plus durable object storage in staging                                                                                                 | `app/profile/page.tsx`, `profile-editor.tsx`, `api/profile/**`, `api/media/avatar/**`                                          |
| Profile publication                 | Implemented and browser-tested         | Visibility button -> independent completeness check -> owner profile update + audit -> public endpoint appears/disappears                                 | A published edit that removes required data returns `409` until restored or explicitly saved private                                                                 | `profile-editor.tsx`, `api/profile/visibility/route.ts`, `talent/server/publication.ts`                                        |
| Portfolio create/edit/delete/media  | Implemented and browser-tested         | Owner form -> owner-checked metadata/media mutation -> scanned private storage -> safe public/owner rendering -> replacement/deletion cleanup             | Configure production storage reconciliation and verify PDF download behavior in staging                                                                              | `profile-editor.tsx`, `api/profile/portfolio/**`, `api/media/portfolio/**`                                                     |
| Jobs workspace tabs                 | Implemented and browser-tested         | Authenticated user -> participant agreements, owned listings, or owned proposals -> authorized SQL search -> linked rows and matching empty state         | Add cursor pagination when measured per-account row counts approach the release threshold                                                                            | `app/jobs/page.tsx`                                                                                                            |
| Jobs agreement search/status filter | Implemented and tested                 | GET form -> Zod query parser -> participant condition plus title/reference/email/name/status SQL -> filtered rows/empty state                             | Cursor pagination remains a future volume optimization                                                                                                               | `app/jobs/page.tsx`, `features/jobs/server/filters.ts`                                                                         |
| Public job creation                 | Implemented and browser-tested         | Listing wizard -> persistent draft URL -> reload/edit -> publish checks -> listing and milestone rows -> discovery                                        | AI builder uses mock output by default                                                                                                                               | `app/jobs/new/public/page.tsx`, `listing-wizard.tsx`, `api/marketplace/listings/**`                                            |
| Direct job invitation               | Implemented for existing users         | Wizard -> fee quote -> existing-account validation -> job, milestones, operation and recipient notification -> Jobs                                       | External email delivery/claiming remains a separate future workflow. No funding occurs                                                                               | `app/jobs/new/direct/page.tsx`, `job-wizard.tsx`, `api/fees/quote/route.ts`, `api/jobs/route.ts`                               |
| Awarded proposal draft confirmation | Implemented and browser-tested         | Client button -> atomic owner/state claim -> `INVITED`, operation, audit, and worker notification                                                         | Funding and acceptance remain PactAgent-gated                                                                                                                        | `confirm-draft-button.tsx`, `api/jobs/[id]/confirm/route.ts`                                                                   |
| Agreement detail                    | Implemented pre-funding UI             | Participant-only query -> participants/terms/milestones/proofs/dispute/cancellation state -> role-aware controls                                          | Funded acceptance and settlement remain disabled pending authoritative PactAgent state                                                                               | `app/jobs/[id]/page.tsx`, `features/jobs/components/agreement-actions.tsx`                                                     |
| Worker acceptance                   | API-only and PactAgent-blocked         | Worker/state/identity/wallet checks -> payout snapshot -> job/milestone state updates                                                                     | Requires authoritative funded state from PactAgent and a customer UI; current error text still assumes funded invitation                                             | `api/jobs/[id]/accept/route.ts`                                                                                                |
| Proof submission/files              | Implemented and browser-tested         | Worker/state checks -> proof form with links/files/progress/cancel/retry -> scanned private storage -> participant-only download                          | Eligible state is established only in the disposable test database; runtime remains PactAgent-gated                                                                  | `agreement-actions.tsx`, `api/milestones/[id]/proofs/route.ts`, `api/proofs/[id]/files/route.ts`, `api/files/[id]/route.ts`    |
| Milestone review/revision           | Implemented and browser-tested         | Client sees latest proof -> atomic approve/revision transition -> review rows and pending release intent                                                  | Approval creates a pending release operation only; no settlement occurs                                                                                              | `agreement-actions.tsx`, `api/milestones/[id]/review/route.ts`                                                                 |
| Cancellation                        | Implemented and browser-tested         | Participant/state checks -> atomic request/counterparty accept/decline transition                                                                         | Any refund outcome remains pending and requires PactAgent                                                                                                            | `agreement-actions.tsx`, `api/jobs/[id]/cancellation/route.ts`                                                                 |
| Disputes/evidence                   | Implemented and browser-tested         | Participant case/evidence/history -> scanned private files -> dispute-admin queue -> proposed decision -> distinct second approval                        | Approval creates only a pending settlement intent; PactAgent must confirm execution                                                                                  | `features/jobs/components/dispute-workspace.tsx`, `app/admin/disputes/**`, `api/disputes/**`, `api/admin/disputes/**`          |
| Reviews/reputation                  | Implemented and browser-tested         | Completed-job participants -> unique concurrent-safe reviews -> derived public metrics                                                                    | Reviews remain participant-authored marketplace feedback                                                                                                             | `engagement-review.tsx`, `api/jobs/[id]/reviews/route.ts`, `reputation/server/queries.ts`                                      |
| Payments page/history               | Partial and honest                     | Participant-scoped confirmed operations -> historical totals/table                                                                                        | Current secured balance is unavailable. There is no reconciled chain balance, funding action, release confirmation, refund confirmation, or settlement UI            | `app/payments/page.tsx`, `payments/server/queries.ts`, `dashboard/server/metrics.ts`                                           |
| Wallet & Security page              | Implemented and browser-tested         | Session -> user-scoped wallet/identity/session/hold/MFA records -> owner-checked mutations -> refreshed records and security notifications                | Direct browser-extension connection and production wallet certification remain pending                                                                               | `app/wallet/page.tsx`, `features/wallet/**`, `features/security/**`                                                            |
| Wallet challenge/verification       | Implemented and browser-tested         | Auth + same-origin -> expiring challenge -> CKB signature/address/network verification -> defaults, removal, optional payout hold, audit and notification | Valid deterministic CKB signing and replay rejection are automated; certify each supported real wallet extension and network before release                          | `api/wallets/**`, `server/wallet/verify.ts`                                                                                    |
| Identity                            | Local workflow implemented and tested  | Authenticated start -> configured provider record -> redirect/status UI; sandbox completion is limited to loopback development/disposable E2E             | Select and implement a production KYC provider adapter plus signed callback/webhook verification                                                                     | `app/identity/**`, `api/identity/**`, `server/identity/provider.ts`, `server/deployment.ts`                                    |
| MFA and active sessions             | Implemented and browser-tested         | Password/Google login -> short-lived TOTP challenge -> session; settings -> encrypted enrollment, hashed recovery codes, disable; remote sessions revoke  | Provision `MFA_ENCRYPTION_KEY` in production and validate hosted secret rotation/recovery procedures                                                                 | `api/auth/mfa/**`, `api/auth/sessions/**`, `server/auth/mfa.ts`                                                                |
| Activity                            | Partial                                | Signed-in actor -> own `audit_logs` -> chronological list                                                                                                 | Audit coverage is incomplete: several state-changing endpoints do not call `audit`, including wallet verification and milestone review. Add a mandatory audit matrix | `app/activity/page.tsx`, `server/audit.ts`                                                                                     |
| Notifications                       | Implemented and browser-tested         | User-scoped list -> individual/read-all mutations, destination marking, email preferences, deduplicated retrying delivery outbox -> badge/UI refresh      | Configure Resend and scheduled retry invocation in production                                                                                                        | `notification-inbox.tsx`, `api/notifications/**`, `server/notifications/**`                                                    |
| Support complete lifecycle          | Implemented and browser-tested         | Owner/support authorization -> create, assign, reply, scanned attachment, status, close/reopen -> events, audit, notifications and email outbox           | Guide topics intentionally remain non-link labels until full editorial guides are published                                                                          | `support-home.tsx`, `ticket-conversation.tsx`, `admin-ticket-workspace.tsx`, `api/support/**`, `api/admin/support/**`          |

## UI control and navigation checklist

- [x] Desktop sidebar, top bar, marketplace header, mobile bottom navigation, logo, Dashboard return, notifications, profile, and logout point to implemented routes or actions.
- [x] Create Job routes to a working choice page; direct and public creation forms have API-backed submit behavior.
- [x] Discover and Talent search, selects, advanced filters, clear links, and pagination submit real URL-backed queries.
- [x] Jobs agreement search, status select, Apply, and Clear are functional and preserve authorization constraints.
- [x] Profile edit, publish/private, portfolio add/edit/delete, and public-preview controls are wired.
- [x] Proposal compose/edit/withdraw, shortlist/reject/award, and message controls call protected endpoints.
- [x] Support new-case jump, category choices, ticket rows, replies, attachments, close, and admin queue controls are wired.
- [x] Notification individual/read-all controls, destination marking, unread badge, and email preferences are wired.
- [x] Wallet connect is explicitly disabled and explains the integration dependency; fabricated copy/explorer/change actions were removed.
- [x] Support guide topics no longer masquerade as four separate articles.
- [x] Agreement detail exposes proof submit, client review/revision, cancellation, and dispute controls only in permitted states; worker acceptance remains visibly PactAgent-blocked.
- [x] Password request/reset has complete customer pages, single-use tokens, session revocation, and browser coverage.
- [ ] Identity start/return needs customer pages.

## API endpoint inventory

All mutation routes below use schema validation. Customer mutations generally use same-origin checks; resource routes then apply owner, participant, or role checks. “Code-traced” means not exercised end to end unless noted above.

| Endpoint group                                                                                                                                  | Status and authorization                                            | Persistence / limitation                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/login`, `logout`, `register`, `verify-email`, `password/request`, `password/reset`; `GET /api/auth/me`                          | Code-traced; account/session scoped                                 | Users, profiles, sessions, tokens, audit. Email delivery/UI gaps noted above                                |
| `GET /api/auth/google`, `GET /api/auth/google/callback`                                                                                         | Owner-tested; state/nonce/provider validation                       | Auth identities, users, profiles, sessions; preserved                                                       |
| `GET/PATCH /api/profile`; `PATCH /api/profile/visibility`                                                                                       | Tested; signed-in owner only                                        | Profiles and audit logs                                                                                     |
| `POST /api/profile/portfolio`; `PATCH/DELETE /api/profile/portfolio/[id]`                                                                       | Create/edit tested; owner checked; create idempotent                | Portfolio items, operation, audit                                                                           |
| `POST/DELETE /api/profile/avatar`; `POST/DELETE /api/profile/portfolio/[id]/media`                                                              | Browser-tested; owner only; same-origin mutation guard              | Quarantined/scanned bytes, media metadata, profile/portfolio keys, audit                                    |
| `GET /api/media/avatar/[userId]`; `GET /api/media/portfolio/[id]`                                                                               | Browser-tested; owner or public-profile authorization; clean only   | Private file bytes with `nosniff`, restrictive CSP, and visibility-aware caching                            |
| `GET /api/talent`, `GET /api/talent/[id]`                                                                                                       | Code-traced; public-only data                                       | Sanitized public profile/portfolio/reputation                                                               |
| `GET/POST /api/marketplace/listings`; `GET/PATCH /[id]`; `POST /[id]/publish`, `/close`, `/cancel`                                              | Code-traced; writes require owner                                   | Listings and listing milestones                                                                             |
| `GET/POST /api/marketplace/listings/[id]/proposals`; `GET/PATCH/DELETE /[id]/proposal`                                                          | Code-traced; eligibility/owner constraints                          | Proposal and milestone rows; no payment action                                                              |
| `PATCH /api/marketplace/proposals/[id]/shortlist`; `POST /reject`, `/award`                                                                     | Code-traced; listing owner                                          | Award atomically creates a draft job and notifications, not funding                                         |
| `GET/POST /api/marketplace/proposals/[id]/messages`                                                                                             | Browser-tested; proposal participants; idempotent and rate-limited  | Proposal messages, per-user read cursors, in-app notification, email outbox                                 |
| `GET/POST /api/jobs`; `GET /api/jobs/[id]`; `POST /confirm`, `/accept`, `/cancellation`                                                         | Create and filter-adjacent behavior tested; participant/role checks | Job/milestone state machine; accept/funding path awaits PactAgent                                           |
| `GET/POST /api/jobs/[id]/disputes`; `POST /api/disputes/[id]/evidence`; `GET /api/dispute-files/[id]`; `POST /api/admin/disputes/[id]/decision` | Browser/concurrency-tested; participants or dispute admins only     | Private evidence/history and two-person decisions; settlement remains pending PactAgent confirmation        |
| `GET/POST /api/jobs/[id]/reviews`                                                                                                               | Browser/concurrency-tested; completed-job participants              | Unique marketplace reviews and reputation                                                                   |
| `POST /api/milestones/[id]/proofs`; `POST /api/proofs/[id]/files`; `POST /api/milestones/[id]/review`; `GET /api/files/[id]`                    | Browser/concurrency-tested; participant/role/state checks           | Proof/revision/approval/files; release operation is pending only                                            |
| `POST /api/fees/quote`                                                                                                                          | Code-traced; authenticated                                          | Expiring fee quote used for direct jobs; estimate only                                                      |
| `GET /api/wallets`; `POST /challenge`, `/verify`; `PATCH/DELETE /[id]`                                                                          | Browser-tested; authenticated owner                                 | Verified ownership/default/revoked records and payout-change holds; no balance/payment implication          |
| `GET/POST /api/identity`; `POST /api/identity/sandbox/complete`                                                                                 | Browser-tested locally; authenticated                               | Provider-labeled records; sandbox is loopback/test-only and not production assurance                        |
| `GET/POST /api/auth/mfa`; `POST /confirm`, `/challenge`, `/disable`; `GET/DELETE /api/auth/sessions/**`                                         | Browser-tested; authenticated or short-lived challenge              | Encrypted TOTP, hashed single-use recovery codes, and owner-scoped active-session revocation                |
| `GET /api/notifications`, `/unread`, `/preferences`; `POST /read`, `/[id]/read`; `PUT /preferences`                                             | Browser-tested; current user only                                   | Read timestamps, preferences, audit, badge refresh                                                          |
| `GET/POST /api/support/tickets`; `GET /[id]`; `POST /[id]/messages`, `/attachments`, `/close`, `/reopen`; attachment download                   | Browser-tested; ticket owner only; replies idempotent/rate-limited  | Tickets, messages, events, scanned files, audit, notification delivery                                      |
| `GET /api/admin/support/agents`, `/tickets`, `/tickets/[id]`; `PATCH /tickets/[id]`; `POST /tickets/[id]/messages`                              | Browser-tested; support/super-admin only                            | Queue, assignment, validated transitions, internal/public messages, outbox                                  |
| `POST /api/ai/job-builder`, `/api/ai/proposal-assistant`                                                                                        | Partial; authenticated/eligible                                     | Defaults to deterministic template provider; audit record does not make output authoritative                |
| `POST /api/internal/jobs/[id]/sandbox-fund`, `/reviews/auto-approve`, `/security-holds/release`                                                 | Local/internal support only                                         | Never expose as production payment or review confirmation; deployment guards require dedicated verification |

## Dummy-data cleanup inventory

The runtime source previously retained six unreferenced feature fixture modules containing fabricated activity, jobs, listings, notifications, payments, and talent. The repository also exposed an opt-in preview flag and a local seeder capable of creating six demo accounts plus synthetic profiles, identities, portfolios, wallet records, jobs, milestones, proofs, reviews, listings, and proposals. None was imported by a customer-facing route, but retaining it increased the risk of accidental reuse and made data provenance harder to audit.

This pass removed those fixture modules, the orphaned preview helper and test, both preview/seed environment variables, the demo seed command and implementation, demo account documentation, and the now-obsolete cleanup runbook. The deterministic marketplace drafting implementation remains because it is active product behavior; it was renamed from `mock` to `template`, continues to generate editable drafts only, and does not create database records by itself.

A read-only inventory against `127.0.0.1:5433/klaveroq` found `0` exact legacy demo users, `0` `KQ-DEMO-%` jobs, `0` total jobs, and `0` listings. The database's one unrelated account was not changed. Fabricated records used by unit and browser tests remain isolated to test code and the disposable `klaveroq_test` database.

## Verification performed

### Automated checks

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: 25 files, 108 tests passed, including authentication provider boundaries,
  local-delivery, deployment guards, notification delivery policy, TOTP/encryption, file validation,
  malware rejection, pagination, audit coverage, idempotency, and security headers.
- `npm run build`: passed; all application and API routes compiled successfully.
- Disposable PostgreSQL 17 migrations on `127.0.0.1:55434/klaveroq_test`: passed after a guarded schema reset.
- Isolated HTTP workflow suite against the running Next.js app: passed login, profile persistence, portfolio create/edit persistence, public profile unpublish/republish, Jobs text/status filtering, support ticket create/list retrieval, wallet/security empty-state assertions, and authorized stored-wallet rendering.
- Playwright empty-database/profile journey: passed from a freshly migrated schema. It exercised Google-equivalent initialization, name-only and partial private saves, field-level validation, incomplete publication, multi-session completion, non-JSON failed-save recovery, publication, safe published edits, `409` incomplete-public-edit handling, portfolio persistence, logout, and repeat sign-in.
- Playwright Chromium desktop marketplace journey: passed with fresh client, worker, and competing-worker accounts activated only in the disposable test database. It covered profile publication, portfolio creation, draft save/reload/edit/publish, unauthorized draft edit, filtered discovery, proposal submission/edit/refresh persistence, concurrent proposals, participant messaging, shortlist, award, losing-worker notification, and the agreement draft in both Jobs workspaces.
- Playwright API/database integration suite: passed name-only profile `200`, partial save `200`, invalid target `400`, incomplete publish `422`, published-profile conflict `409`, explicit private fallback, listing publication, cross-account edit denial, concurrent and duplicate proposals, messages, and atomic award.
- Playwright Pixel 7 viewport checks: passed public marketplace and authenticated professional-profile rendering with no horizontal document overflow.
- Playwright authentication journey: passed registration, verification, resend invalidation, expired and replayed tokens, password recovery, session revocation, duplicate registration, lockout, and rate limiting.
- Playwright Phase 2 security journey: passed identity start/sandbox verification, real CKB testnet signing, replay and origin rejection, wallet removal, current-session protection, remote-session revocation, TOTP enrollment/login, invalid-code rejection, one-time recovery-code login, and MFA disable.
- Playwright Phase 3 media journey: passed content-spoof, oversize, EICAR, and cross-account rejection; private/public retrieval; control-driven avatar and portfolio upload; reload persistence; avatar replacement; alternative text; and byte/record removal.
- Playwright Phase 4 communications journey: passed individual notification read/unread and destination marking, preference persistence/enforcement, failed-delivery retry, deduplication, proposal unread badges, support authorization, assignment, public reply, scanned attachment download, close, and reopen.
- Playwright Phase 5 agreement journey: passed confirmed worker invitation and notification, proof submission, revision, revised proof, pending approval intent, client and worker reviews, and cancellation request/decline through the real browser UI.
- Playwright Phase 5 dispute journey: passed participant dispute creation, scanned evidence-file upload/history, dispute-admin queue/detail, distinct second-approver selection and approval, participant-visible rationale/history, and a `PENDING` settlement record with no external reference.
- Playwright Phase 5 concurrency suite: passed simultaneous proof, approval, cancellation, marketplace-review, decision-proposal, and second-approval requests with exactly one accepted transition and one conflict for each pair.
- Playwright Phase 8 journey: passed super-admin support/dispute access, explicit permission denial,
  expired-session redirection, notification loading/error feedback, and narrow-screen long-content
  reflow.
- Accessibility suite: passed serious/critical WCAG A/AA Axe checks on authentication and public
  marketplace pages, keyboard skip navigation and focus, 200% zoom reflow, and reduced motion.
- Warmed local load baseline: 100 requests per endpoint at concurrency 10 and zero errors. P95 was
  55.8 ms for liveness, 256.8 ms for discovery, and 332.4 ms for talent. This is not production
  capacity evidence.
- Final local Playwright run: 27 tests passed across the complete Chromium project, WebKit smoke,
  and Pixel 7 mobile project. Firefox is installed and configured in CI, but its macOS binary could
  not see Playwright's generated temporary profile on two launch attempts; no application page or
  assertion ran. The first Ubuntu CI run remains the Firefox release evidence.

No Supabase endpoint, seed command, PactAgent integration, fabricated payment confirmation, deployment, commit, or push was used.

### Exact remaining manual browser cases

1. Complete the real-provider cases in `docs/STAGING_PROVIDER_CHECKLIST.md`, including first/repeat
   Google sign-in and real email delivery.
2. Run VoiceOver/Safari and NVDA/Firefox across the critical journeys and retain the manual record.
3. Repeat load, backup/restore, privacy, and rollback checks against staging infrastructure and
   attach the results to `docs/RELEASE_CHECKLIST.md`.
4. Complete named product, engineering, platform, security/privacy, and release-manager sign-off.

## Prioritized implementation plan

### Complete before production or PactAgent

1. **P0: Add authoritative PactAgent state before enabling worker acceptance or any funding-dependent action.**
2. **P0: Design external invitation claiming separately** with an expiring, single-use token, verified recipient ownership, email delivery, authentication handoff, and atomic account linking.
3. **P0: Configure and certify external providers in staging** using the provider checklist; local
   email, identity, scanning, and storage adapters must never be treated as production capability.
4. **P1: Complete manual assistive-technology, staging load/recovery/privacy, and release sign-off.**
5. **P1: Publish full editorial support guides** when reviewed content and ownership are available;
   topics remain honest non-link labels meanwhile.

### Must wait for PactAgent integration

1. Funding request creation, wallet signing, chain submission, confirmation depth, retry/idempotency, and authoritative funded-state transitions.
2. Reconciled secured balances and transaction explorer links.
3. Milestone release settlement, worker payout confirmation, fees, and finality.
4. Cancellation refunds, dispute settlement splits, failed-operation recovery, and security-hold release tied to authoritative chain state.
5. Production claims such as “protected payment,” “escrow,” “funds secured,” “settled,” or “refunded.” These must be derived from reconciled PactAgent results, not local rows or seeded timestamps.

## Files changed in this repair pass

### Phase 8 product-wide verification and release readiness (2026-09-26)

- Added pull-request/main CI for formatting, lint, typecheck, unit tests, production build, database
  migration, Chromium/Firefox/WebKit/Pixel 7 Playwright coverage, and failed-run artifacts.
- Added automated WCAG, keyboard, focus, zoom, reduced-motion, cross-browser, super-admin,
  permission, expired-session, loading, error, and long-content checks.
- Added a universal skip link, reduced-motion handling, readable long-notification wrapping, and an
  explicit operations-console permission-denied message without redesigning existing sections.
- Added release and staging-provider checklists with owners, evidence, thresholds, rollback steps,
  privacy checks, manual accessibility gates, and sign-off fields.

### Phase 7 audit, security, and operational readiness (2026-09-25)

- Added request correlation to every API response and audit row, privacy-safe structured logs, an
  optional monitoring webhook, and liveness/readiness endpoints with production dependency/config
  reporting.
- Completed audit coverage for every state-changing endpoint and added an automated route scan,
  audit-metadata redaction tests, and a documented endpoint/action/target matrix.
- Standardized actor-scoped idempotency keys for retryable creates/messages while retaining atomic
  state claims, operation uniqueness, notification dedupe, and delivery retry claims.
- Added an authenticated retention job for expired sessions/tokens/challenges/rate limits and old
  delivered email bodies, plus explicit legal-hold and gated account-closure rules.
- Added backup and guarded restore tools and verified an isolated restore with exact source counts:
  2 users, 17 audits, 1 listing, 2 operations, and 15 migrations.
- Added response security headers, production readiness checks, incident/recovery/secret-rotation
  runbooks, and a security review. Dependency updates removed all high/critical production
  advisories; four low transitive CKB/JoyID `elliptic` findings remain documented pending upstream.
- Added Phase 7 PostgreSQL/browser coverage for correlation, audit attribution, retry replay,
  readiness, and retention enforcement.

### Phase 6 search, pagination, and data correctness (2026-09-25)

- Added validated opaque composite cursors for listing date/budget and talent reputation,
  completed-work, and recent-update ordering, including stable ID tie breakers.
- Moved talent filtering and global ranking into PostgreSQL, added real talent pagination, and
  replaced proposal milestone N+1 reads with one ordered batch query.
- Added owned-listing and owned-proposal workspace search with authorized SQL predicates and clear
  filtered empty states.
- Defined listing visibility: discovery is open-only; closed and awarded detail stays public;
  drafts and cancelled listings stay owner-only and are never rendered publicly.
- Added migration `0014_classy_vengeance.sql`, cursor unit coverage, and a PostgreSQL/Playwright
  scenario for equal values, page mutations, filters, empty results, malformed cursors, private
  talent, sealed proposals, and cross-account authorization.
- A rolled-back 10,000-row plan review used the new composite indexes, returned listing and
  recent-talent pages below 0.03 ms locally, and completed global top-N reputation ranking in 3.2
  ms. Production telemetry should determine when reputation summaries and workspace cursor
  pagination become necessary.

### Phase 5 agreements and dispute operations (2026-09-25)

- Added worker agreement-confirmation delivery and a confirmed-invitation next-action state that
  accurately waits for PactAgent funding confirmation.
- Added participant dispute evidence notes, scanned private files, authorized downloads, evidence
  history, decision rationale, settlement status, and authoritative case events.
- Added the dispute-admin queue and case workspace, restricted `DISPUTE_ADMIN` navigation, and a
  two-person proposal/approval workflow that creates only a pending PactAgent settlement intent.
- Hardened proof, milestone review, cancellation, marketplace review, dispute opening, and dispute
  decision transitions against duplicate and concurrent requests.
- Added migration `0013_classy_ego.sql` and Phase 5 browser/concurrency coverage. Eligible funded
  states are created only inside the guarded disposable test database; no application funding
  bypass was added.

### Phase 4 notifications, messaging, and support completion (2026-09-25)

- Added individual notification read/unread controls, mark-on-destination-open behavior, and
  customer-managed proposal, message, job, dispute, and support email preferences. Mandatory
  security notifications are not controlled by these optional categories.
- Added proposal-conversation read cursors and participant-specific unread counts without exposing
  sealed proposal data.
- Added deduplicated in-app event keys and a persistent email outbox with atomic delivery claims,
  capped exponential backoff, interrupted-claim recovery, and opportunistic retry processing.
- Routed proposal submission/messages/decisions, awards, direct invitations, disputes, support
  status changes, assignments, and replies through preference-aware notification delivery.
- Added proposal-message and support-reply rate limits, reply idempotency, support attachment count
  and total-size limits, validated administrative state transitions, explicit customer reopen, and
  audit coverage for replies, attachments, closing, reopening, and preferences.
- Added migration `0012_complex_khan.sql`, pure delivery-policy tests, proposal unread browser
  assertions, and the complete support/notification lifecycle browser journey.
- Real Resend receipt and a production scheduled retry trigger remain configuration gates.

### Phase 3 files, avatars, portfolios, and proof evidence (2026-09-25)

- Added content-derived JPEG, PNG, WebP, PDF, and plain-text validation with per-workflow size
  limits, quarantine-first writes, SHA-256 metadata, clean-only reads, and path traversal guards.
- Added a malware-scanner boundary with local EICAR detection for development/E2E and ClamAV
  `INSTREAM` support for production. Hosted production fails closed when scanning is unavailable.
- Added owner-managed avatar and portfolio media upload, replacement, rendering, alternative text,
  and deletion, including private/public authorization and safe response headers.
- Added proof evidence selection, upload progress, cancellation, retry, stored-file rendering, and
  participant-only download behavior without bypassing the PactAgent funding gate.
- Hardened proof and support attachments to store detected content types and remove bytes after a
  scan or database failure. Added migration `0011_panoramic_invaders.sql` for media metadata.
- Defined immediate deletion and production reconciliation rules in `IMPLEMENTATION_PHASES.md`.
  Production ClamAV/storage configuration is intentionally deferred with the other provider setup.

### Phase 1 authentication and email delivery (2026-09-25)

- Added a production Resend provider boundary and loopback-test-only local delivery mode.
- Standardized root `.env` loading for Next.js and Drizzle and allowed the documented `127.0.0.1` development origin so client forms hydrate correctly.
- Added verification, resend, forgot-password, and reset-password customer pages.
- Made verification and reset tokens replacement-based, atomic, single use, and expiry checked.
- Added PostgreSQL-backed authentication rate limits through migration `0009_mean_shadow_king.sql`.
- Added password-reset session revocation, authentication audit events, provider documentation, unit tests, and a complete browser security journey.
- Real Resend delivery and real Google OAuth remain staging verification gates because provider credentials are not available locally.

### Phase 2 identity, wallet ownership, and account security (2026-09-25)

- Added provider-labeled identity status/start screens and a loopback-only sandbox completion screen; hosted production fails closed until a real provider adapter is configured.
- Added CKB signed-message ownership UI, default funding/payout selection, 24-hour payout-change holds, immutable wallet revocation, audit records, and security notifications.
- Added active-session listing and owner-scoped remote revocation while explicitly protecting the current session.
- Selected TOTP MFA and implemented encrypted secret storage, setup confirmation, short-lived login challenges, hashed single-use recovery codes, Google/password-login enforcement, and disable flow through migration `0010_petite_bruce_banner.sql`.
- Production KYC callbacks, real wallet-extension connectors/certification, real Google OAuth, and real Resend delivery remain external-environment gates.

### Dummy-data cleanup and navigation refinement (2026-09-25)

- Removed six unused runtime fixture modules, the orphaned preview-mode helper/configuration, and the complete demonstration-data seeder surface.
- Confirmed the loopback development database has no known demo records and preserved its unrelated account.
- Renamed the active deterministic drafting implementation and audit label from `mock` to `template` without changing draft behavior.
- Added nested-route active navigation, `aria-current`, and mobile-menu expanded/controls semantics; added a browser regression assertion.
- Removed two `.DS_Store` metadata files and the obsolete seeded-data cleanup runbook; retained migrations, tests, and architecture material that still have a defined purpose.

### Fresh Google profile editing (2026-09-25)

- Confirmed the root cause: browser-required completion fields prevented submit, while a bypassed request returned `400` because the edit schema required headline, bio, primary role, and country.
- Split strict partial editing from publication completeness and added a guarded `409` choice for published profiles that would become incomplete.
- Removed fabricated experience and location values from the editor payload and generated migration `0008_curvy_oracle.sql` to stop assigning `Africa/Lagos` to new profiles.
- Added field-level errors, expired-session guidance, partial private saves, immediate rendering, focused profile sections, and responsive behavior.
- Added database/API and browser coverage for fresh Google-equivalent initialization, gradual completion, publication, published edits, persistence, and unauthorized target rejection.

### Clean database, profile reliability, and verification (2026-09-24)

- Reset `klaveroq_klaveroq_postgres`, reapplied migrations, and verified zero business records.
- Previously isolated the optional demonstration seeder behind loopback/opt-in guards; the 2026-09-25 cleanup removed it entirely.
- Standardized local browser and OAuth documentation on `http://127.0.0.1:3000`.
- Made profile and portfolio requests resilient to network and non-JSON failures while preserving unsaved input and restoring saved values on Cancel.
- Added empty-database/profile/portfolio/logout/repeat-sign-in Playwright coverage and mocked Google claim validation tests.
- Replaced remaining customer-facing payment-protection claims with accurate standalone marketplace language.

### Standalone marketplace completion (2026-09-24)

- Public listing draft UI/page and My Listings draft navigation.
- Existing-user direct invitation validation and recipient notifications.
- Duplicate-proposal conflict handling for both normal and concurrent submissions.
- Agreement participant, milestone, proof/review, cancellation, dispute, and funding-gate UI.
- Disposable PostgreSQL service, guarded reset, Playwright configuration, desktop/mobile browser tests, and API/database integration tests.
- Local testing documentation and this audit.

No database schema migration was required for the standalone marketplace pass. Google OAuth routes, credentials, and callback configuration were not changed.

### Prior repair pass (2026-09-23)

- `apps/web/src/app/wallet/page.tsx`
- `apps/web/src/app/jobs/page.tsx`
- `apps/web/src/features/jobs/server/filters.ts`
- `apps/web/src/features/jobs/server/filters.test.ts`
- `apps/web/src/components/layout/app-shell.tsx`
- `apps/web/src/features/jobs/components/job-wizard.tsx`
- `apps/web/src/app/jobs/[id]/page.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/discover/page.tsx`
- `apps/web/src/app/talent/[userId]/page.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/features/notifications/notification-inbox.tsx`
- `apps/web/src/features/support/components/support-home.tsx`
- `apps/web/src/styles/globals.css`
