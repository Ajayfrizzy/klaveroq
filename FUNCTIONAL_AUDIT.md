# Klaveroq Functional Audit

Audit date: 2026-09-24

Milestone: standalone marketplace, before PactAgent integration

## Status legend

- **Implemented and tested**: the expected observable result was exercised against a disposable local PostgreSQL database.
- **Implemented, code-traced**: UI, authorization, validation, database operation, and result rendering exist, but the complete browser workflow was not exercised in this audit.
- **Partial**: useful behavior exists, but an advertised workflow is incomplete or only available through an API.
- **UI-only / inactive**: no authoritative operation exists behind the control.
- **PactAgent-blocked**: must not be represented as operational until the external integration and reconciliation are implemented.

## Executive findings

- [x] The runtime marketplace pages read PostgreSQL through Drizzle. Public discovery and talent do not import fixture data.
- [x] The dedicated local development volume was reset, migrations were reapplied, and all marketplace/business tables were confirmed empty.
- [x] Google authentication code and credentials were preserved; mocked provider claims cover valid and invalid identities. Real-Google browser verification remains manual.
- [x] Fresh private profiles can now be saved incrementally. Editing and publishing use separate validation rules, with field-level errors and an explicit private fallback for incomplete published profiles.
- [x] Profile persistence, failed-save input retention, portfolio create/edit/delete, public profile visibility, logout/repeat sign-in, Jobs filtering, support submission/retrieval, and wallet empty/stored-record states passed isolated browser or HTTP workflow tests.
- [x] The Wallet & Security page now reads only the signed-in user's wallet, identity, session, and hold records. Fabricated addresses, dates, events, device counts, MFA, and protection claims were removed.
- [x] The signed-in Jobs search and status filter now submit URL parameters and constrain an authorized database query.
- [x] PactAgent/Mainnet operational copy was removed from the shell, dashboard, direct-job flow, job detail, talent invitation, discovery copy, and metadata.
- [x] Inert notification preferences are explicitly disabled. Placeholder support-guide links are now non-interactive labels.
- [x] Public listing draft persistence, reload/edit/publish, filtered discovery, proposals, participant-only messaging, shortlist, concurrent award, notifications, and persistent agreement-draft creation passed a real multi-account Playwright run against disposable PostgreSQL.
- [x] Agreement detail now displays both participants, terms, milestones, proof/review controls for valid in-progress states, cancellation and dispute controls, and explicit pre-funding/PactAgent gates.
- [x] Direct invitations are restricted to existing Klaveroq accounts and create a linked recipient notification. Unknown-email invitations return `ACCOUNT_NOT_FOUND` and create no invitation.
- [ ] Payment funding, escrow balances, releases, refunds, settlement, and blockchain reconciliation are not implemented. Database statuses and timestamps are not proof of an on-chain operation.

## Customer-facing feature audit

| Feature                                | Actual status                          | UI -> authorization -> data -> observable result                                                                                             | Missing behavior / required test                                                                                                                                     | Primary files                                                                                                                  |
| -------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Password login                         | Implemented, code-traced               | Login form -> `POST /api/auth/login` -> same-origin check, password verification, lockout checks -> `sessions` insert and cookie -> redirect | Browser test lockout, cookie expiry, and error states                                                                                                                | `features/auth/components/auth-form.tsx`, `api/auth/login/route.ts`, `server/auth/session.ts`                                  |
| Registration                           | Partial                                | Register form -> `POST /api/auth/register` -> validated user/profile/token inserts -> session/email state                                    | No production email delivery was found for verification. Test duplicate email and real mail handoff before release                                                   | `auth-form.tsx`, `api/auth/register/route.ts`, `api/auth/verify-email/route.ts`                                                |
| Google sign-in                         | Mock-tested; real browser test pending | Google start/callback -> state, nonce, issuer/audience/email checks -> user/identity/profile/session upsert -> redirect                      | Complete the documented real-provider repeat-login, logout, persistence, and restart checks before release                                                           | `api/auth/google/route.ts`, `api/auth/google/callback/route.ts`, `server/auth/google.ts`                                       |
| Password reset                         | API-only / partial                     | Request/reset endpoints validate tokens and update credentials                                                                               | No customer reset pages or confirmed mail delivery. Add request and reset UI, mail adapter, expiry/replay browser tests                                              | `api/auth/password/request/route.ts`, `api/auth/password/reset/route.ts`                                                       |
| Dashboard                              | Implemented, code-traced               | Authenticated page -> participant-scoped jobs, actions, verification records, confirmed-operation aggregates -> cards/lists                  | Payment balance remains explicitly unavailable. Add page-level database tests and browser checks for each role/state                                                 | `app/page.tsx`, `features/dashboard/server/queries.ts`, `metrics.ts`, `onboarding.ts`                                          |
| Global navigation                      | Implemented, code-traced               | Sidebar, top bar, mobile menu, and marketplace header destinations all resolve to existing pages                                             | Active-state matching covers exact paths only; nested Jobs/Profile highlighting is cosmetic                                                                          | `components/layout/app-shell.tsx`, `features/marketplace/components/marketplace-header.tsx`                                    |
| Find Work search/filter/sort           | Implemented, code-traced               | GET form -> parsed query/category/skill/sort -> only open, unexpired `job_listings` -> listing cards                                         | Cursor ordering can duplicate equal cursor values; add query integration tests for all filters and pagination                                                        | `app/discover/page.tsx`, `marketplace/server/queries.ts`, `marketplace/server/schemas.ts`                                      |
| Listing detail                         | Implemented, code-traced               | Public ID -> non-draft/non-cancelled listing, milestones, client public data, derived reputation -> detail page                              | Closed listings are intentionally viewable. Confirm privacy policy and test malformed/not-found IDs                                                                  | `app/discover/[id]/page.tsx`, `marketplace/server/queries.ts`                                                                  |
| Proposal create/edit/withdraw          | Implemented, code-traced               | Composer -> eligibility and ownership checks -> proposals and proposal milestones transaction -> refreshed UI                                | No browser run in this audit. AI drafting defaults to a mock provider and must be labeled as draft assistance                                                        | `proposal-composer.tsx`, `api/marketplace/listings/[id]/proposals/route.ts`, `api/marketplace/listings/[id]/proposal/route.ts` |
| Proposal messages                      | Implemented, code-traced               | Participant-only thread -> messages endpoint -> `proposal_messages` -> refreshed thread                                                      | Thread loads on demand. Add unread state, rate limiting, and browser tests                                                                                           | `proposal-thread.tsx`, `api/marketplace/proposals/[id]/messages/route.ts`                                                      |
| Client proposal evaluation             | Implemented, code-traced               | Listing owner sees sealed proposals -> shortlist/reject/award endpoints -> transactional proposal/listing updates and notifications          | Award creates a `DRAFT` job only, not funding. Browser-test concurrency and losing-proposal notifications                                                            | `client-proposals.tsx`, `api/marketplace/proposals/[id]/{shortlist,reject,award}/route.ts`                                     |
| Find Talent                            | Implemented, code-traced               | GET filters -> only public profiles -> portfolio previews and database-derived reputation -> cards                                           | Reputation sorting after a 100-profile pre-limit is not globally correct. Move derived ordering/pagination to a scalable query                                       | `app/talent/page.tsx`, `features/talent/server/queries.ts`, `schemas.ts`                                                       |
| Public talent profile                  | Implemented and tested                 | Public/owner authorization -> sanitized profile, portfolio, completed-work metrics -> public page                                            | External portfolio URLs are user supplied; retain safe protocol validation and add UI accessibility checks                                                           | `app/talent/[userId]/page.tsx`, `talent/server/public-profile.ts`, `authorization.ts`                                          |
| Profile editing                        | Implemented and browser-tested         | Owner form -> strict partial `PATCH /api/profile` -> field validation -> owner row update + audit -> immediate and refreshed result          | Avatar upload is absent although `avatarKey` exists                                                                                                                  | `app/profile/page.tsx`, `profile-editor.tsx`, `api/profile/route.ts`                                                           |
| Profile publication                    | Implemented and browser-tested         | Visibility button -> independent completeness check -> owner profile update + audit -> public endpoint appears/disappears                    | A published edit that removes required data returns `409` until restored or explicitly saved private                                                                 | `profile-editor.tsx`, `api/profile/visibility/route.ts`, `talent/server/publication.ts`                                        |
| Portfolio create/edit/delete           | Implemented and browser-tested         | Owner form -> idempotent create or owner-checked patch/delete -> `portfolio_items` -> local UI update and persisted reload                   | Media upload is absent although `mediaKey` exists                                                                                                                    | `profile-editor.tsx`, `api/profile/portfolio/**`                                                                               |
| Jobs workspace tabs                    | Implemented, code-traced               | Authenticated user -> participant agreements, owned listings, or owned proposals -> linked rows                                              | Listings/proposals tabs have no local search/filter; add if volume requires it                                                                                       | `app/jobs/page.tsx`                                                                                                            |
| Jobs agreement search/status filter    | Implemented and tested                 | GET form -> Zod query parser -> participant condition plus title/reference/email/name/status SQL -> filtered rows/empty state                | Add database-level tests for counterparty-name and authorization isolation                                                                                           | `app/jobs/page.tsx`, `features/jobs/server/filters.ts`                                                                         |
| Public job creation                    | Implemented and browser-tested         | Listing wizard -> persistent draft URL -> reload/edit -> publish checks -> listing and milestone rows -> discovery                           | AI builder uses mock output by default                                                                                                                               | `app/jobs/new/public/page.tsx`, `listing-wizard.tsx`, `api/marketplace/listings/**`                                            |
| Direct job invitation                  | Implemented for existing users         | Wizard -> fee quote -> existing-account validation -> job, milestones, operation and recipient notification -> Jobs                          | External email delivery/claiming remains a separate future workflow. No funding occurs                                                                               | `app/jobs/new/direct/page.tsx`, `job-wizard.tsx`, `api/fees/quote/route.ts`, `api/jobs/route.ts`                               |
| Awarded proposal draft confirmation    | Partial                                | Client button -> owner/state check -> `DRAFT` to `INVITED`, operation and audit                                                              | No worker-facing action appears on job detail; no notification is created by draft confirmation                                                                      | `confirm-draft-button.tsx`, `api/jobs/[id]/confirm/route.ts`                                                                   |
| Agreement detail                       | Implemented pre-funding UI             | Participant-only query -> participants/terms/milestones/proofs/dispute/cancellation state -> role-aware controls                             | Funded acceptance and settlement remain disabled pending authoritative PactAgent state                                                                               | `app/jobs/[id]/page.tsx`, `features/jobs/components/agreement-actions.tsx`                                                     |
| Worker acceptance                      | API-only and PactAgent-blocked         | Worker/state/identity/wallet checks -> payout snapshot -> job/milestone state updates                                                        | Requires authoritative funded state from PactAgent and a customer UI; current error text still assumes funded invitation                                             | `api/jobs/[id]/accept/route.ts`                                                                                                |
| Proof submission/files                 | UI implemented for eligible states     | Worker/state checks -> agreement form -> proof records and authorized file storage/download                                                  | File upload UI and malware scanning remain absent; links and notes are supported                                                                                     | `agreement-actions.tsx`, `api/milestones/[id]/proofs/route.ts`, `api/proofs/[id]/files/route.ts`                               |
| Milestone review/revision              | UI implemented for eligible states     | Client sees latest proof -> approve/revision controls -> review rows and milestone transition                                                | Approval creates a pending release operation only; no settlement occurs                                                                                              | `agreement-actions.tsx`, `api/milestones/[id]/review/route.ts`                                                                 |
| Cancellation                           | UI implemented for permitted states    | Participant/state checks -> request/counterparty accept/decline controls -> persisted transition                                             | Any refund outcome remains pending data and requires PactAgent                                                                                                       | `agreement-actions.tsx`, `api/jobs/[id]/cancellation/route.ts`                                                                 |
| Disputes/evidence                      | Partial UI                             | Participant opens a milestone/job dispute from agreement detail; evidence API and admin decision remain role-gated                           | Dispute evidence upload and complete admin decision UI remain standalone work; settlement is PactAgent-blocked                                                       | `agreement-actions.tsx`, `api/jobs/[id]/disputes/route.ts`, `api/disputes/[id]/evidence/route.ts`                              |
| Reviews/reputation                     | Implemented, code-traced               | Completed-job participant -> one review per reviewer -> stored review -> derived public metrics                                              | Seeded reviews are demonstrations, not external verification. Browser-test both participants and duplicate prevention                                                | `engagement-review.tsx`, `api/jobs/[id]/reviews/route.ts`, `reputation/server/queries.ts`                                      |
| Payments page/history                  | Partial and honest                     | Participant-scoped confirmed operations -> historical totals/table                                                                           | Current secured balance is unavailable. There is no reconciled chain balance, funding action, release confirmation, refund confirmation, or settlement UI            | `app/payments/page.tsx`, `payments/server/queries.ts`, `dashboard/server/metrics.ts`                                           |
| Wallet & Security page                 | Implemented and tested                 | Session -> user-scoped wallets/latest identity/active sessions/active holds -> truthful records and unavailable states                       | Connect/change wallet UI intentionally disabled. Session revocation, MFA, and login alerts do not exist                                                              | `app/wallet/page.tsx`, `server/auth/session.ts`                                                                                |
| Wallet challenge/verification          | API-only, untested                     | Auth + same-origin -> challenge -> CKB signature check -> wallet/default update and optional hold                                            | No UI. Must test real supported wallets/networks before enabling; wallet record is not proof of balance or payment capability                                        | `api/wallets/challenge/route.ts`, `api/wallets/verify/route.ts`, `server/wallet/verify.ts`                                     |
| Identity                               | Partial / sandbox                      | Authenticated API starts configured provider and stores latest record                                                                        | Default provider is sandbox; no customer UI was found. Sandbox completion must never be presented as production identity assurance                                   | `api/identity/route.ts`, `api/identity/sandbox/complete/route.ts`, `server/identity/provider.ts`                               |
| Activity                               | Partial                                | Signed-in actor -> own `audit_logs` -> chronological list                                                                                    | Audit coverage is incomplete: several state-changing endpoints do not call `audit`, including wallet verification and milestone review. Add a mandatory audit matrix | `app/activity/page.tsx`, `server/audit.ts`                                                                                     |
| Notifications                          | Partial                                | User-scoped list/unread/read-all -> database updates -> badge refresh                                                                        | No individual mark-read-on-open and no preferences model. Settings control is now disabled with an explanation                                                       | `notification-inbox.tsx`, `api/notifications/**`                                                                               |
| Support create/list/detail/reply/close | Implemented and tested for create/list | Auth -> owner-scoped tickets/messages/attachments -> transactional creation and refreshed UI                                                 | Full reply/attachment/close browser flow not run. Guide articles are not published and are no longer fake links                                                      | `support-home.tsx`, `ticket-conversation.tsx`, `api/support/tickets/**`                                                        |

## UI control and navigation checklist

- [x] Desktop sidebar, top bar, marketplace header, mobile bottom navigation, logo, Dashboard return, notifications, profile, and logout point to implemented routes or actions.
- [x] Create Job routes to a working choice page; direct and public creation forms have API-backed submit behavior.
- [x] Discover and Talent search, selects, advanced filters, clear links, and pagination submit real URL-backed queries.
- [x] Jobs agreement search, status select, Apply, and Clear are functional and preserve authorization constraints.
- [x] Profile edit, publish/private, portfolio add/edit/delete, and public-preview controls are wired.
- [x] Proposal compose/edit/withdraw, shortlist/reject/award, and message controls call protected endpoints.
- [x] Support new-case jump, category choices, ticket rows, replies, attachments, close, and admin queue controls are wired.
- [x] Notification “Mark all read” is wired; notification settings is explicitly disabled.
- [x] Wallet connect is explicitly disabled and explains the integration dependency; fabricated copy/explorer/change actions were removed.
- [x] Support guide topics no longer masquerade as four separate articles.
- [x] Agreement detail exposes proof submit, client review/revision, cancellation, and dispute controls only in permitted states; worker acceptance remains visibly PactAgent-blocked.
- [ ] Password request/reset and identity start/return need customer pages.

## API endpoint inventory

All mutation routes below use schema validation. Customer mutations generally use same-origin checks; resource routes then apply owner, participant, or role checks. “Code-traced” means not exercised end to end unless noted above.

| Endpoint group                                                                                                                     | Status and authorization                                            | Persistence / limitation                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/login`, `logout`, `register`, `verify-email`, `password/request`, `password/reset`; `GET /api/auth/me`             | Code-traced; account/session scoped                                 | Users, profiles, sessions, tokens, audit. Email delivery/UI gaps noted above                                |
| `GET /api/auth/google`, `GET /api/auth/google/callback`                                                                            | Owner-tested; state/nonce/provider validation                       | Auth identities, users, profiles, sessions; preserved                                                       |
| `GET/PATCH /api/profile`; `PATCH /api/profile/visibility`                                                                          | Tested; signed-in owner only                                        | Profiles and audit logs                                                                                     |
| `POST /api/profile/portfolio`; `PATCH/DELETE /api/profile/portfolio/[id]`                                                          | Create/edit tested; owner checked; create idempotent                | Portfolio items, operation, audit                                                                           |
| `GET /api/talent`, `GET /api/talent/[id]`                                                                                          | Code-traced; public-only data                                       | Sanitized public profile/portfolio/reputation                                                               |
| `GET/POST /api/marketplace/listings`; `GET/PATCH /[id]`; `POST /[id]/publish`, `/close`, `/cancel`                                 | Code-traced; writes require owner                                   | Listings and listing milestones                                                                             |
| `GET/POST /api/marketplace/listings/[id]/proposals`; `GET/PATCH/DELETE /[id]/proposal`                                             | Code-traced; eligibility/owner constraints                          | Proposal and milestone rows; no payment action                                                              |
| `PATCH /api/marketplace/proposals/[id]/shortlist`; `POST /reject`, `/award`                                                        | Code-traced; listing owner                                          | Award atomically creates a draft job and notifications, not funding                                         |
| `GET/POST /api/marketplace/proposals/[id]/messages`                                                                                | Code-traced; proposal participants                                  | Proposal messages                                                                                           |
| `GET/POST /api/jobs`; `GET /api/jobs/[id]`; `POST /confirm`, `/accept`, `/cancellation`                                            | Create and filter-adjacent behavior tested; participant/role checks | Job/milestone state machine; accept/funding path awaits PactAgent                                           |
| `GET/POST /api/jobs/[id]/disputes`; `POST /api/disputes/[id]/evidence`; `POST /api/admin/disputes/[id]/decision`                   | Code-traced; participant/admin role checks                          | Dispute/evidence/decision records; settlement remains pending                                               |
| `GET/POST /api/jobs/[id]/reviews`                                                                                                  | Code-traced; completed-job participants                             | Marketplace reviews and reputation                                                                          |
| `POST /api/milestones/[id]/proofs`; `POST /api/proofs/[id]/files`; `POST /api/milestones/[id]/review`; `GET /api/files/[id]`       | Code-traced; participant/role/state checks                          | Proof/review/files; release operation is pending only                                                       |
| `POST /api/fees/quote`                                                                                                             | Code-traced; authenticated                                          | Expiring fee quote used for direct jobs; estimate only                                                      |
| `GET /api/wallets`; `POST /api/wallets/challenge`, `/verify`                                                                       | Code-traced; authenticated owner                                    | Wallet records/challenges/holds; no enabled UI and no balance/payment implication                           |
| `GET/POST /api/identity`; `POST /api/identity/sandbox/complete`                                                                    | Code-traced; authenticated                                          | Sandbox/default provider records; not production assurance                                                  |
| `GET /api/notifications`, `/unread`; `POST /read`                                                                                  | Code-traced; current user                                           | User-scoped notification rows/read timestamps                                                               |
| `GET/POST /api/support/tickets`; `GET /[id]`; `POST /[id]/messages`, `/attachments`, `/close`; `GET /api/support/attachments/[id]` | Create/list tested; other routes code-traced; ticket owner only     | Tickets/messages/events/files/notifications                                                                 |
| `GET /api/admin/support/agents`, `/tickets`, `/tickets/[id]`; `PATCH /tickets/[id]`; `POST /tickets/[id]/messages`                 | Code-traced; support/super-admin only                               | Queue, assignment, state changes, internal/public messages                                                  |
| `POST /api/ai/job-builder`, `/api/ai/proposal-assistant`                                                                           | Partial; authenticated/eligible                                     | Defaults to deterministic mock provider; audit record does not make output authoritative                    |
| `POST /api/internal/jobs/[id]/sandbox-fund`, `/reviews/auto-approve`, `/security-holds/release`                                    | Local/internal support only                                         | Never expose as production payment or review confirmation; deployment guards require dedicated verification |

## Seeded demonstration data inventory

### Configuration finding

The current `apps/web/.env` identifies `127.0.0.1:5433/klaveroq`; it does not point the runtime Drizzle client at Supabase. Docker confirmed this is `klaveroq-postgres-1`, backed by the dedicated named volume `klaveroq_klaveroq_postgres`. On 2026-09-24 that exact volume was removed and recreated, then every migration was applied. The separate test service remains tmpfs-backed on port 55434.

Runtime pages use the database query layer; repository fixtures under `features/*/fixtures.ts` have no runtime imports. The demonstration seeder is isolated behind the explicitly named `db:seed:demo` command, requires `KLAVEROQ_ALLOW_LOCAL_SEED=1`, rejects production, and accepts only a loopback database hostname. Normal startup and all automated tests do not invoke it.

### Candidate records and dependencies

| Seed candidate                             | Baseline dependencies created by `seed.ts`                                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alex Morgan (`client@klaveroq.local`)      | Active user, public profile, sandbox identity; client on 2 demo jobs and owner of 3 listings; author/recipient of demo reviews                                   |
| Maya Chen (`worker@klaveroq.local`)        | Active user, public profile, portfolio item, sandbox identity, synthetic testnet wallet; worker on 2 demo jobs; proposal and proposal milestones; proofs/reviews |
| Idris Bello                                | Active user, public profile, portfolio item, sandbox identity                                                                                                    |
| Sofia Alvarez                              | Active user, public profile, portfolio item, sandbox identity                                                                                                    |
| Jordan Okafor                              | Active `DISPUTE_ADMIN`, private profile, sandbox identity                                                                                                        |
| Amara Support                              | Active `SUPPORT`, private profile, sandbox identity                                                                                                              |
| `KQ-DEMO-1048`                             | Alex client, Maya worker and payout wallet, 3 milestones, seeded funded/accepted timestamps                                                                      |
| `KQ-DEMO-COMPLETE`                         | Alex client, Maya worker, completed/released milestone history, proof submissions, reviews                                                                       |
| Build a responsive analytics dashboard     | Open listing, 2 listing milestones, Maya proposal with 3 proposal milestones                                                                                     |
| Create a fintech onboarding content system | Open listing owned by Alex                                                                                                                                       |
| Research merchant payout workflows         | Closed listing owned by Alex                                                                                                                                     |

The seed's `VERIFIED` sandbox identities, synthetic wallet, funded timestamps, released milestones, proofs, and reviews are demonstration data. They must not be interpreted as real identity, wallet, blockchain, settlement, or customer evidence. The seeder is guarded by a loopback hostname plus `KLAVEROQ_ALLOW_LOCAL_SEED=1`; retain that guard and keep these fixtures local-only.

## Verification performed

### Automated checks

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: 15 files, 82 tests passed, including partial-profile validation, mocked Google identity claims, and Jobs-filter regression tests.
- `npm run build`: passed; all application and API routes compiled successfully.
- Disposable PostgreSQL 17 migrations on `127.0.0.1:55434/klaveroq_test`: passed after a guarded schema reset.
- Isolated HTTP workflow suite against the running Next.js app: passed login, profile persistence, portfolio create/edit persistence, public profile unpublish/republish, Jobs text/status filtering, support ticket create/list retrieval, wallet/security empty-state assertions, and authorized stored-wallet rendering.
- Playwright empty-database/profile journey: passed from a freshly migrated schema. It exercised Google-equivalent initialization, name-only and partial private saves, field-level validation, incomplete publication, multi-session completion, non-JSON failed-save recovery, publication, safe published edits, `409` incomplete-public-edit handling, portfolio persistence, logout, and repeat sign-in.
- Playwright Chromium desktop marketplace journey: passed with fresh client, worker, and competing-worker accounts activated only in the disposable test database. It covered profile publication, portfolio creation, draft save/reload/edit/publish, unauthorized draft edit, filtered discovery, proposal submission/edit/refresh persistence, concurrent proposals, participant messaging, shortlist, award, losing-worker notification, and the agreement draft in both Jobs workspaces.
- Playwright API/database integration suite: passed name-only profile `200`, partial save `200`, invalid target `400`, incomplete publish `422`, published-profile conflict `409`, explicit private fallback, listing publication, cross-account edit denial, concurrent and duplicate proposals, messages, and atomic award.
- Playwright Pixel 7 viewport checks: passed public marketplace and authenticated professional-profile rendering with no horizontal document overflow.

No Supabase endpoint, seed command, PactAgent integration, fabricated payment confirmation, deployment, commit, or push was used.

### Exact remaining manual browser cases

1. Open `http://127.0.0.1:3000`, complete Google consent with a previously used account, and confirm exactly one user, one Google identity, and one editable profile are created in the reset development database.
2. Repeat Google sign-in, refresh an authenticated page, log out, restart the application, and sign in again; confirm no duplicate user, identity, or profile rows.
3. Open `/jobs`, search by title, reference, worker email, and participant display name; combine each with a status; confirm Clear restores all authorized agreements and another user never appears.
4. Submit a support case, open it, reply with and without an allowed attachment, reload, close it, and verify the closed composer disappears.
5. Test all changed pages at mobile and desktop widths for long wallet addresses, user agents, status labels, and filter wrapping.

## Prioritized implementation plan

### Complete before PactAgent

1. **P0: Add authoritative PactAgent state before enabling worker acceptance or any funding-dependent action.**
2. **P0: Design external invitation claiming separately** with an expiring, single-use token, verified recipient ownership, email delivery, authentication handoff, and atomic account linking.
3. **P0: Remove sandbox trust from non-local environments**. Gate sandbox identity completion, sandbox funding, auto-review, and local seed behavior with tested deployment assertions.
4. **P1: Finish account recovery and identity UI** with real mail/provider adapters, callback handling, and clear provider labels.
5. **P1: Complete support hardening**: attachment scanning/quarantine, reply/close browser tests, guide content, and clearer upload failure recovery.
6. **P1: Make audit coverage systematic** for every state-changing route, including wallet, proof review, disputes, notification reads, and support replies.
7. **P2: Add notification preferences and individual read semantics**, or continue to keep settings disabled.
8. **P2: Add the Playwright and disposable database commands to CI**; the local harness and core marketplace scenarios now exist.

### Must wait for PactAgent integration

1. Funding request creation, wallet signing, chain submission, confirmation depth, retry/idempotency, and authoritative funded-state transitions.
2. Reconciled secured balances and transaction explorer links.
3. Milestone release settlement, worker payout confirmation, fees, and finality.
4. Cancellation refunds, dispute settlement splits, failed-operation recovery, and security-hold release tied to authoritative chain state.
5. Production claims such as “protected payment,” “escrow,” “funds secured,” “settled,” or “refunded.” These must be derived from reconciled PactAgent results, not local rows or seeded timestamps.

## Files changed in this repair pass

### Fresh Google profile editing (2026-09-25)

- Confirmed the root cause: browser-required completion fields prevented submit, while a bypassed request returned `400` because the edit schema required headline, bio, primary role, and country.
- Split strict partial editing from publication completeness and added a guarded `409` choice for published profiles that would become incomplete.
- Removed fabricated experience and location values from the editor payload and generated migration `0008_curvy_oracle.sql` to stop assigning `Africa/Lagos` to new profiles.
- Added field-level errors, expired-session guidance, partial private saves, immediate rendering, focused profile sections, and responsive behavior.
- Added database/API and browser coverage for fresh Google-equivalent initialization, gradual completion, publication, published edits, persistence, and unauthorized target rejection.

### Clean database, profile reliability, and verification (2026-09-24)

- Reset `klaveroq_klaveroq_postgres`, reapplied migrations, and verified zero business records.
- Isolated the optional demonstration seeder behind the explicit `db:seed:demo` command and existing loopback/opt-in guards.
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
