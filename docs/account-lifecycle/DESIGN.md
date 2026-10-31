# Account lifecycle audit and design (M2)

## Audit before implementation

Staging base: 6c824c1. Users own credentials and status; profiles are presentation data.
Sessions LEFT JOIN profiles, password login selects users, and profile editing returns
PROFILE_NOT_FOUND when its row is absent. `/profile` redirects a signed-in user without
a profile to login. Other consumers assume a profile exists. Thus manual profile
removal can create a login/redirect loop without invalidating the password. Reproduce
this with synthetic accounts before changing profile behavior; never query hosted data.

`audit_logs.actor_user_id -> users.id` uses NO ACTION (no cascade). Jobs, proofs,
operations, decisions and many other records also reference users. Keep the user UUID
as a tombstone; never hard-delete a user, weaken these FKs or erase audit history.

## Retention matrix (approved implementation scope, not legal policy)

| Entities                                                                           | Classification                            | Pending                                                           | Final processing                                                                                                           |
| ---------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| users                                                                              | private, credentials, relationship anchor | preserve credentials for explicit recovery; block marketplace use | replace email with unique invalid-domain tombstone, erase password/login metadata, retain UUID and closed state            |
| profiles                                                                           | private/public presentation               | hide; remember previous visibility                                | replace with private empty Closed account profile                                                                          |
| portfolio_items, media_files                                                       | personal/public uploads                   | hide with profile                                                 | erase text/links; retain storage keys privately for authorized object-removal review, never lose orphan cleanup references |
| user_preferences, saved_searches, talent_shortlist_items, notification_preferences | private convenience data                  | preserve                                                          | delete owner preferences/searches/shortlists; remove references to unavailable talent                                      |
| sessions, verification_tokens, mfa_login_challenges, wallet_challenges             | secrets/authentication                    | revoke sessions and outstanding tokens/challenges                 | delete credentials/challenges                                                                                              |
| mfa_methods, auth_identities                                                       | security credentials/provider link        | retain for recovery                                               | delete credentials/provider subjects                                                                                       |
| auth_rate_limits                                                                   | security evidence, hashed                 | retain                                                            | existing short-lived policy; never remove to enable bypass                                                                 |
| jobs (agreements), milestones, job_payout_destinations, fee_quotes                 | shared/financial                          | active obligations block closure; preserve history                | preserve references, text and captured payment addresses for authorized retention review                                   |
| operations, wallets                                                                | financial/settlement evidence             | unsettled operations block closure                                | preserve evidence; review applicable jurisdiction/purpose; no universal timed destruction                                  |
| disputes, dispute_evidence/files/events/decisions                                  | shared, security/legal                    | open cases block closure                                          | preserve for authorized review                                                                                             |
| proof_submissions/files, reviews, revision_requests                                | shared deliverables/evidence              | unresolved deliverables block closure                             | preserve counterparty rights and records                                                                                   |
| job_listings, job_listing_milestones                                               | public/shared                             | remove open listings from discovery                               | preserve shared text for review, remain closed                                                                             |
| proposals, proposal_milestones/messages/thread_reads                               | shared/counterparty                       | withdraw outstanding submissions                                  | preserve shared records; private read markers may be removed                                                               |
| marketplace_reviews                                                                | shared reputation                         | preserve                                                          | retain legitimate historical reviews with closed display identity                                                          |
| client_invites                                                                     | private/shared onboarding                 | revoke outstanding sent invitations                               | preserve linked/shared records for review; invalidate pending tokens                                                       |
| notifications, notification_deliveries                                             | private and security evidence             | retain security confirmation with transactional outbox            | redact inbox text and recipient/bodies of outbox; preserve delivery evidence                                               |
| audit_logs, security_holds                                                         | audit/security evidence                   | never delete; active holds block requests/recovery/cleanup        | retain restricted, minimal new audit events; no broad scrub of historical evidence                                         |
| identity_verifications                                                             | sensitive external identity/risk evidence | retain                                                            | retain privately for authorized review; no external provider deletion without policy                                       |
| support_tickets/messages/attachments/events                                        | private/shared/security                   | privacy/support requests remain available through dedicated route | preserve pending case/evidence for review                                                                                  |
| account_closures, account_holds (new)                                              | minimal lifecycle/security evidence       | schedule/reason/deadline/visibility snapshot                      | minimal retained history and review date; no credentials in audit metadata                                                 |

`account_privacy_requests` retains contact email, the submitted request and an operational
review date in a privileged queue. It is not public and is not automatically purged
while a request may require a response. Its retention classification needs authorized
review alongside support records.

No financial history does not mean no retention: shared messages, support evidence,
media or security evidence may require review. ANONYMIZED denotes minimization of the
account's direct identity, not a guarantee that all historical shared text is anonymous.
CLOSED_RETAINED records have historical obligations/evidence needing classified review.
Retention review dates are operational follow-up dates, not invented legal deadlines.
Existing financial/audit constants are not authorization for automated deletion.

## State machine and concurrency

ACTIVE/PENDING_EMAIL_VERIFICATION -> PENDING_DELETION after fresh credentials,
MFA where enabled, literal DELETE confirmation and eligibility checks. Repeated requests
return the same request/deadline. No new session is issued. Recovery requires literal
RECOVER and fresh credentials before the database-clock deadline, and returns ACTIVE
(or unverified if it was never verified). Login never cancels a request.
PENDING_DELETION -> CLOSED_RETAINED/ANONYMIZED after 30 days and a second eligibility
check. Suspension/security review/legal holds prevent ordinary use and recovery.
Staff review can release a hold but cannot silently recover or bypass an obligation.

Lifecycle transitions serialize under an exclusive database advisory gate; other HTTP
mutations use its shared side for the entire handler. A separate bounded connection
pool owns the gate, avoiding deadlock with application transactions. Cleanup uses the
same exclusive gate. This prevents an in-flight marketplace write racing the final
blocker check, including counterparty actions. This conservative beta gate prioritizes
correctness; it can delay other mutations during a bounded cleanup batch. Any future
worker writing obligations must join the gate. Out-of-band database writes are not an
application API and must not run concurrently with cleanup. Each account also locks its
user row, and state changes, outbox and audit events commit together.

## Migration integration

Staging ends at 0017. Open Vellum PR #5 has 0018 and its own snapshot/journal history.
Generate M2 with a timestamp prefix to avoid SQL filename collision. The snapshot and
journal still branch from 0017: before merging the second feature, regenerate its
migration from the already merged schema/history using Drizzle. Do not concatenate or
hand-edit generated snapshots/journals. Do not change Vellum in this milestone.
