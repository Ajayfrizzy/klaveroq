# Klaveroq Implementation Phases

## UI/UX improvement phases (September 26, 2026)

The UI/UX review is being implemented in four sequential phases, preserving payment and identity truthfulness.

1. **Navigation and discovery:** consistent signed-in shell; accessible public mobile menu; compact filters, removable chips, actionable empty states and accurate pagination labels.
2. **Task clarity:** role-aware onboarding; operational dashboard metrics; clear agreement next actions and secondary technical details.
3. **Forms and hiring:** guided profile sections, tag and searchable inputs; unsaved-work protection, draft status and error focus; talent shortlist, comparison, saved searches and timezone context.
4. **Visual consistency and verification:** readable type, touch targets, distinctive trust accents; authenticated accessibility and mobile journey coverage; lint, types, unit tests, build and browser checks.

Status: all four UI/UX phases implemented and verified locally.

### UI/UX phase 1 — navigation and discovery

- [x] Public mobile menu exposes work, talent, sign-in, and registration; sign-in preserves the current destination.
- [x] Signed-in discovery, talent profiles, listing details, and hiring pages use the workspace shell.
- [x] Search remains visible; secondary filters collapse, applied filters are removable, and clearing them resets the controls.
- [x] Empty marketplaces and unmatched searches have different messages and useful recovery actions.
- [x] Cursor navigation is labeled “Next page,” matching its actual behavior.

### UI/UX phase 2 — task clarity

- [x] Dashboard focus can switch between hiring, working, and both; profile readiness uses publication requirements.
- [x] Active jobs and pending actions replace unavailable financial summary cards; payment limitations remain explicit.
- [x] Agreement guidance reflects the participant, agreement state, and milestone state without claiming funding or settlement.
- [x] Jobs show actual milestone progress and next steps. Payment record detail is disclosed separately; mobile milestones precede secondary controls.

### UI/UX phase 3 — forms and hiring tools

- [x] Profile editing has navigable, collapsible sections, removable skill/language tags, country search, timezone suggestions, and a persistent save action.
- [x] Long forms expose unsaved state, warn on link navigation/browser unload, retain input on failed requests, and focus validation feedback. Support submission recovers after network failures.
- [x] Talent can be shortlisted and compared using fresh public profile data; unavailable profiles are handled without persisting profile copies.
- [x] Searches can be named, restored, and removed; talent cards explain reputation provenance and timezone differences.

Preferences, up to three shortlisted profile IDs, and up to eight searches per marketplace are stored on the current device, scoped to the account (or guest). They do not sync across devices or send alerts. Sensitive form drafts are not persisted in browser storage. Forms show explicit unsaved state rather than claiming autosave; save or submit before using browser history navigation.

### UI/UX phase 4 — visual consistency and verification

- [x] Readable operational type, stronger text contrast, larger shared touch targets, teal trust accents, and responsive comparison tables.
- [x] Mobile workspace navigation traps focus, closes with Escape, restores focus, and makes background content inert. Short desktop sidebars scroll to keep account actions reachable.
- [x] Automated checks cover public and authenticated accessibility, profile uploads/editing, keyboard navigation, failures, comparisons, invalid job forms, and mobile agreement reflow.

Verification: lint and TypeScript pass; 111 unit tests pass. A 34-test Chromium/mobile/WebKit run passed 33 tests and exposed job-wizard contrast issues. After correction, all 10 focused UI/UX and agreement regression tests passed, including the previously failing scenario. Production builds passed through the browser test harness. Screenshots were reviewed for mobile discovery/agreement pages and desktop talent comparison. Existing external-provider and manual screen-reader release gates remain separate.

Updated: 2026-09-25

This roadmap covers the work required to complete Klaveroq outside PactAgent funding, settlement,
refund, and reconciliation. Phases are ordered so later work builds on stable authentication,
security, and provider boundaries. Each phase should be completed and verified before the next one
starts.

## Working rules

- Do not represent local database state as proof of funding, escrow, settlement, or refund.
- Keep sandbox and internal-only routes unavailable in hosted production.
- Every mutation must have validation, authorization, audit coverage, an observable UI result, and
  an automated failure-path test.
- A phase is complete only when its acceptance criteria and quality gate pass.
- Update `FUNCTIONAL_AUDIT.md` at the end of every phase.

## Phase 1: Authentication and email delivery

**Goal:** Make registration, verification, sign-in, and account recovery complete customer
workflows.

**Status:** Implemented and verified locally. Real Resend delivery and real Google OAuth staging
verification remain external-environment gates.

### Scope

- [x] Add a transactional email provider boundary and production implementation.
- [x] Send email-verification links after registration.
- [x] Add verification result, expired-link, and resend-verification UI.
- [x] Add forgot-password and reset-password pages around the existing APIs.
- [x] Send password-reset links without exposing whether an account exists.
- [x] Revoke existing sessions after a successful password reset and explain that result to the user.
- [ ] Verify real Google OAuth first login, repeat login, logout, and restart persistence in staging.
- [x] Add rate limits for registration, login, verification resend, and password reset.

### Acceptance criteria

- [ ] A new user can register, receive a verification email, verify, sign out, and sign in again. Local delivery is verified; receipt through Resend remains a staging check.
- [x] An existing user can request and complete a password reset from the UI.
- [x] Expired, reused, malformed, and superseded tokens fail safely.
- [ ] Google sign-in never creates duplicate users, identities, or profiles in the configured staging environment.

### Quality gate

- [x] Automated tests cover token expiry, consumption, resend invalidation, and rate limits.
- [ ] Browser tests cover registration, verification, reset, lockout, and repeat Google sign-in. All except real Google sign-in are verified.
- [x] Provider failures produce recoverable UI behavior and server error logs.

## Phase 2: Identity, wallet ownership, and account security

**Goal:** Make non-payment trust and security functions usable without implying PactAgent balances.

**Status:** Core local workflows implemented and verified. Production identity-provider selection,
provider callback verification, and supported browser-wallet certification remain external gates.

### Scope

- [ ] Add the production identity-provider adapter and callback/webhook verification.
- [x] Build identity start, redirect, pending, failed, expired, and verified screens.
- [ ] Build wallet connect, challenge, signature verification, default selection, and removal UI. Manual CKB signed-message verification and record management are complete; a supported browser-wallet connector remains.
- [ ] Verify supported CKB wallets and networks with real signatures.
- [x] Add active-session listing and remote session revocation.
- [x] Decide the MFA method and implement enrollment, recovery, challenge, and disable flows. TOTP with encrypted secrets and one-time recovery codes is implemented.
- [x] Add security notifications for password changes, new sessions, wallet changes, and MFA changes.
- [x] Enforce deployment guards for every sandbox identity and internal support route.

### Acceptance criteria

- Identity status always comes from the configured provider and is clearly labeled.
- Users can prove wallet ownership and manage wallet records without seeing fabricated balances.
- Users can revoke another session without terminating the current session accidentally.
- Sandbox completion and internal routes cannot run in hosted production.

### Quality gate

- Provider-signature, replay, expiry, wrong-network, and wrong-account tests.
- Browser tests for identity outcomes, wallet management, MFA, and session revocation.
- Deployment tests proving sandbox/internal endpoints are unavailable in production.

Local browser coverage now exercises sandbox identity outcomes, a cryptographically valid CKB
testnet signature, replay rejection, wallet removal, session revocation, and the full TOTP lifecycle.
Provider-webhook signatures and real wallet-extension/network certification remain pending with the
production provider choices.

## Phase 3: Files, avatars, portfolios, and proof evidence

**Goal:** Complete every customer-facing upload workflow safely.

**Status:** Implemented and verified locally. Production ClamAV connectivity remains an external
configuration gate; proof submission stays correctly locked until PactAgent provides authoritative
funding state in normal application use.

### Scope

- [x] Add avatar upload, replacement, rendering, and deletion using `avatarKey`.
- [x] Add portfolio media upload, replacement, rendering, and deletion using `mediaKey`.
- [x] Add milestone proof file upload UI around the existing proof-file APIs.
- [x] Add upload progress, retry, cancellation, file-size limits, and clear validation errors.
- [x] Validate MIME type from file contents rather than trusting the filename or request header.
- [x] Add malware scanning and quarantine before a file becomes downloadable.
- [x] Add accessible alternative text and safe previews for supported media.
- [x] Define orphan-file cleanup and retention rules.

### Acceptance criteria

- Owners can manage profile and portfolio media and see it after reload.
- Workers can attach evidence to eligible milestone submissions.
- Unauthorized, oversized, unsupported, malicious, and quarantined files cannot be retrieved.
- Deleting or replacing records does not leave uncontrolled public files behind.

### Quality gate

- Storage authorization and malicious-file integration tests.
- Browser tests for upload progress, failure recovery, replacement, deletion, and proof download.
- Accessibility checks for file controls, errors, previews, and keyboard interaction.

The browser suite covers avatar and portfolio selection, upload, persisted rendering, replacement,
deletion, malicious and spoofed files, size limits, and private/public authorization. Progress,
cancellation, retry, and proof-file controls are implemented and verified. Phase 5's browser suite
establishes an eligible agreement state directly in the guarded disposable test database, without
exposing a runtime funding shortcut or representing that state as PactAgent confirmation.

### File retention and cleanup policy

- Quarantine bytes are removed immediately after a failed scan. A production storage maintenance
  job must remove abandoned quarantine objects older than 24 hours.
- Replacement, explicit deletion, and failed database writes remove their stored bytes immediately.
- Avatar and portfolio bytes are retained only while referenced by their owner records. Proof and
  support attachments are retained with their parent records and remain authorization-gated.
- Production storage must reconcile database keys daily and remove unreferenced clean objects after
  a seven-day recovery window. Account deletion and legal-retention enforcement remain part of
  Phase 7's product-wide retention work.

## Phase 4: Notifications, messaging, and support completion

**Goal:** Make communication states reliable for active marketplace work.

**Status:** Implemented and verified locally. Real Resend receipt and production retry scheduling
remain staging/operations configuration gates.

### Scope

- [x] Add individual notification read/unread behavior when a destination is opened.
- [x] Implement notification preferences, or permanently remove the disabled settings control.
- [x] Add unread state to proposal conversations.
- [x] Add email notifications for proposals, messages, awards, invitations, disputes, and support replies.
- [x] Add message and support-reply rate limits and abuse controls.
- [x] Complete support reply, attachment, assignment, close, and reopen policy.
- [x] Publish real support guides or keep guide topics as non-link labels.
- [x] Add delivery retry and deduplication for outbound notifications.

### Acceptance criteria

- Read state is consistent between the inbox, badge, and destination page.
- Preference changes affect future deliveries without suppressing mandatory security messages.
- Customers and support agents can complete the full ticket lifecycle.
- Repeated jobs or retries cannot send duplicate notifications.

### Quality gate

- Browser tests for notification state, proposal unread state, and complete support workflows.
- Integration tests for delivery retries, preference enforcement, deduplication, and authorization.

The local provider verifies queued delivery state without sending external mail. Delivery rows are
claimed atomically, retried with capped exponential backoff, recover interrupted claims, and use
unique event keys. New notification events opportunistically process due retries; production must
also invoke the retry worker on a schedule when provider configuration is completed.

## Phase 5: Agreements and dispute operations

**Goal:** Complete every agreement operation that does not require financial settlement.

**Status:** Implemented and verified locally. PactAgent settlement execution and confirmation remain
intentionally unavailable.

### Scope

- [x] Notify the worker when an awarded proposal draft is confirmed.
- [x] Show the confirmed invitation and next expected action on the worker agreement page.
- [x] Browser-test proof submission, revision, approval intent, cancellation, and reviews for both roles.
- [x] Build participant dispute evidence upload and evidence-history UI.
- [x] Build a dispute-admin queue, detail view, second-approver selection, and decision UI.
- [x] Allow `DISPUTE_ADMIN` to reach the correct admin workspace without granting support privileges.
- [x] Show dispute status, evidence, decision rationale, and history to authorized participants.
- [x] Keep settlement operations explicitly pending until PactAgent confirms the outcome.

### Acceptance criteria

- Every non-financial agreement transition has an available UI for the correct role.
- Invalid, duplicate, stale, and unauthorized transitions fail without partial writes.
- Dispute administrators can adjudicate a case, but cannot falsely mark funds settled.
- Participants can see the authoritative non-financial history of their agreement and dispute.

### Quality gate

- State-machine integration tests for every role and valid/invalid transition.
- Concurrent-action tests for approval, cancellation, review, and dispute decisions.
- Browser tests for client, worker, dispute-admin, and second-approver journeys.

The decision flow is explicitly two-stage: one dispute administrator proposes the allocation and
assigns a different administrator, who must approve it independently. Only that approval creates a
single `PENDING` settlement operation; it never records external confirmation or settled funds.
Conditional state claims and database uniqueness constraints reject duplicate or concurrent proof,
review, cancellation, marketplace-review, and dispute-decision mutations without partial writes.
Participant evidence uses scanned private storage with participant/dispute-admin download checks.

## Phase 6: Search, pagination, and data correctness

**Goal:** Make discovery and workspace results correct at production data volumes.

### Scope

- [x] Replace listing date/budget cursors with composite sort-value plus ID cursors.
- [x] Add forward pagination tests for equal dates, equal budgets, deletion, and new inserts.
- [x] Move talent reputation filtering and sorting into a scalable database query.
- [x] Add real talent pagination.
- [x] Remove per-proposal milestone queries from proposal evaluation.
- [x] Add database tests for every listing, talent, job, and authorization filter.
- [x] Confirm and document whether closed listings remain publicly visible.
- [x] Add listing/proposal workspace search when the expected account volume requires it.

### Acceptance criteria

- Pagination produces no duplicates or skipped records for stable data.
- Talent ranking is globally correct rather than correct only within the first 100 profiles.
- Search never leaks private profiles, drafts, sealed proposals, or another user's agreements.
- Query counts and response times remain bounded for realistic result sets.

### Quality gate

- PostgreSQL integration tests with duplicate sort values and multi-account fixtures.
- Query-plan review and representative-volume performance thresholds.
- Browser tests for filters, pagination, empty results, malformed cursors, and authorization.

Phase 6 is complete locally. Listing and talent pages use opaque, validated lexicographic cursors
whose final key is the record ID, and tests cover equal sort values plus deletion and insertion
between pages. Talent completed-work filtering and reputation ordering now happen in PostgreSQL
before the page limit, proposal evaluation batches milestones, and owned listing/proposal tabs have
authorized search and matching empty states. Public discovery contains only open, unexpired
listings; direct detail remains public for `OPEN`, `CLOSED`, and `AWARDED` listings so shared and
historical links remain useful. `DRAFT` and `CANCELLED` listings are visible only to their owner
through the authenticated API and are never rendered as public detail pages.

Migration `0014_classy_vengeance.sql` adds composite listing and talent indexes. A rolled-back
10,000-row `EXPLAIN (ANALYZE, BUFFERS)` review used backward index scans for listing and recent
talent pagination, with local execution below 0.03 ms for each bounded page. Global reputation
ranking used a bounded top-N sort and completed in 3.2 ms. At substantially larger production
scale, reputation should move to transactionally maintained summary rows rather than recalculating
all aggregates.

## Phase 7: Audit, security, and operational readiness

**Goal:** Make sensitive actions traceable and the service operable in production.

### Scope

- [x] Create an audit matrix for every state-changing endpoint.
- [x] Add missing audit events for wallet, identity, milestone review, disputes, notification reads,
      support replies, password reset, session revocation, and administrative actions.
- [x] Standardize idempotency for retryable mutations and background deliveries.
- [x] Add structured logging, correlation IDs, error monitoring, and privacy-safe diagnostics.
- [x] Add readiness/liveness checks and dependency health reporting.
- [x] Verify database backup, restore, migration rollback, and incident procedures.
- [x] Define retention and account-deletion rules for identity, messages, files, proofs, and audits.
- [x] Review authorization, secrets, cookies, headers, dependency risk, and upload handling.

### Acceptance criteria

- Every sensitive mutation has actor, target, action, time, and safe metadata in the audit trail.
- Retried requests do not duplicate state or customer communications.
- Operators can identify an incident, correlate requests, restore data, and rotate credentials.
- Retention and deletion behavior is documented and enforceable.

### Quality gate

- Automated audit-coverage and idempotency tests.
- Backup restoration drill in a disposable environment.
- Security review with all high-severity findings resolved.

Phase 7 is complete locally. Every state-changing API route now records a correlated, privacy-safe
audit event, and a source-level coverage test prevents new mutation routes from bypassing the audit
trail. Retryable create/message operations use one validated actor-scoped idempotency-key policy;
existing conditional transitions, unique operation keys, notification dedupe keys, and atomic
delivery claims continue to protect agreement and background mutations.

Every API response receives a UUID request ID, unhandled failures emit privacy-safe structured JSON
and can be delivered to an optional monitoring webhook, and separate liveness/readiness endpoints
report database and production-configuration health without exposing secrets. Production readiness
fails closed for insecure application URL/session secret, local email, sandbox identity, local file
scanning, missing MFA encryption, or weak scheduled-job credentials. Global response headers now
deny framing/MIME sniffing and restrict referrer/device capabilities; hosted production adds HSTS.

The authenticated daily retention job removes only expired short-lived security and delivered-email
records. Seven-year audit/agreement/evidence rules, legal holds, and the gated account-closure
procedure are documented without enabling unsafe blanket deletion. Backup/restore scripts were
drilled against an isolated database: users, audits, listings, operations, and all 15 migrations
matched the source exactly. Recovery, forward-only migration rollback, incident response, secret
rotation, audit coverage, retention, and security findings are documented in `docs/`.

The dependency pass upgraded Next.js and affected production packages, resolving all critical and
high advisories. Four low-severity transitive `elliptic` findings remain behind the CKB/JoyID stack;
npm offers only an unsafe forced downgrade, so the risk is documented pending an upstream fix.

## Phase 8: Product-wide verification and release readiness

**Goal:** Prove all completed functions work together across roles, devices, and failure states.

**Status:** Implemented and verified locally across Chromium, WebKit, and Pixel 7. The first Linux
CI Firefox pass plus real provider, manual screen-reader, staging load, recovery, privacy, and
release sign-off remain explicit gates.

### Scope

- [x] Run lint, type checks, unit tests, production build, database integration tests, and Playwright
      in CI for every pull request.
- [x] Expand browser coverage across client, worker, support, dispute-admin, and super-admin roles.
- [x] Cover empty, loading, error, permission-denied, expired-session, long-content, and concurrent
      states.
- [x] Run automated keyboard, semantic/ARIA, focus, contrast, zoom, and reduced-motion accessibility
      checks. Manual VoiceOver/NVDA staging sign-off remains.
- [ ] Test supported desktop and mobile browsers. Chromium, WebKit, and Pixel 7 pass locally;
      Firefox is configured but awaits a Linux CI pass after a macOS profile-launch failure.
- [ ] Exercise real email, Google, identity, wallet, storage, and monitoring providers in staging.
- [x] Complete local load, recovery, privacy, and launch rollback checks. Repeat the documented
      infrastructure-dependent checks in staging before release.

### Acceptance criteria

- CI blocks regressions in critical customer workflows.
- Every enabled control has an authorized operation and an observable success/failure result.
- No production screen makes an unsupported identity, security, payment, or settlement claim.
- The release checklist has owners, evidence, rollback steps, and sign-off.

Phase 8 adds required pull-request CI, full Chromium and focused Firefox/WebKit/Pixel 7 projects,
automated accessibility checks, and browser scenarios for every product role plus loading, error,
permission, expired-session, long-content, empty, and concurrent states. The existing operations
runbook is now paired with release and staging-provider checklists containing named ownership roles,
evidence fields, recovery steps, thresholds, and final sign-off.

A warmed local load baseline ran 100 requests per endpoint at concurrency 10 with no failures.
Observed p95 latency was 55.8 ms for liveness, 256.8 ms for discovery, and 332.4 ms for talent.
These values are regression evidence only; staging must repeat the test with production topology and
authenticated mutation traffic. External provider checks remain intentionally open until credentials
and infrastructure are configured.

## Separate PactAgent phase

PactAgent integration begins only after its contract and environment are ready. It will own funding
requests, authoritative funded state, balance reconciliation, milestone release, payouts, refunds,
dispute settlement, confirmation depth, retries, and chain finality. Existing pending operation rows
must not be treated as confirmation.

## Recommended execution order

1. Phase 1: Authentication and email delivery
2. Phase 2: Identity, wallet ownership, and account security
3. Phase 3: Files, avatars, portfolios, and proof evidence
4. Phase 4: Notifications, messaging, and support completion
5. Phase 5: Agreements and dispute operations
6. Phase 6: Search, pagination, and data correctness
7. Phase 7: Audit, security, and operational readiness
8. Phase 8: Product-wide verification and release readiness

Phases 1 through 8 are implemented locally. The next step is external provider and staging
configuration, followed by PactAgent integration when its contract and environment are ready.
