# Legal review and activation checklist

This checklist is not approval. All policy pages remain drafts. No deployment, new mandatory acceptance or account cleanup is authorised by this milestone.

## Identity and operational ownership

- [ ] Verify the operator's legal identity, address and public contact details; do not use example email senders.
- [ ] Appoint accountable policy, privacy and support owners; assess whether a DPO/representative is legally required without claiming one already exists.
- [ ] Approve age/capacity rules, treatment of minors and organisations, and countries where the beta may operate.
- [ ] Establish a working fallback contact, statutory response/escalation process and proportional identity-verification procedure. The current public form is an intake queue, not a complete rights-management service.

## Nigeria-first and international review

- [ ] Qualified counsel assesses the Nigeria Data Protection Act, applicable NDPC requirements and other laws relevant to actual users/processing.
- [ ] Confirm purpose-specific legal bases and documented legitimate-interest assessments where relied on; identify actual legal obligations rather than generic indefinite retention.
- [ ] Confirm rights, exceptions, request deadlines and complaint mechanisms for each relevant jurisdiction.
- [ ] Verify processor/controller roles, contracts, regions, subprocessors and transfer safeguards for RumptyCloud, Supabase, Resend if active, Google if enabled and any additional service.
- [ ] Inspect live network/cookie behaviour, configured session TTL, infrastructure logs and backup retention with separately authorised access; no production secrets should appear in documentation.
- [ ] Approve security and incident-response statements against implemented organisational and deployment controls. No unverified certifications, residency or encryption guarantees.

## Retention and M2

- [ ] Review the entity matrix in `docs/account-lifecycle/DESIGN.md`, including shared text, evidence, files, provider copies and backups.
- [ ] Approve category/purpose-specific retention and review ownership. Thirty days is a recovery policy, not a rights-response deadline or guaranteed erase date.
- [ ] Ensure privacy intake is monitored beyond the latest-50 admin API window and earlier-handling/exception requests have a real escalation route.
- [ ] Review investigation/legal-hold safeguards, counterparty rights, evidence preservation and external obligation reconciliation.
- [ ] Keep ACCOUNT_CLEANUP_ENABLED off until the separate M2 activation checklist is authorised and completed. Publishing a policy does not activate cleanup.

## Marketplace and legal terms

- [ ] Approve content hosting/display licence, user work-product rights and confidentiality responsibilities.
- [ ] Approve eligibility, prohibited-service rules, complaints and proportionate moderation/review procedures.
- [ ] Decide governing law/forum and liability terms with qualified counsel; preserve mandatory rights.
- [ ] Confirm the distinction between invitations, agreement acceptance, service terms, marketing choices and optional tracking consent.

## Payments, identity and uploads

- [ ] Keep real payments, refunds, escrow funding and settlement unavailable until separately approved implementation and policy launch.
- [ ] Approve the proposed 3% client / 2% worker fee and exact basis, rounding, network reserve, asset, tax, cancellation and disclosure rules; code estimates alone are not formal approval.
- [ ] Establish real provider roles/contracts, regulatory analysis, custody/fund flow, refunds, disputes, identity requirements and external reconciliation before payment activation.
- [ ] Revisit notices before real KYC or uploads. Verify providers, scanner/storage deployment and data flows without treating current configuration options as active services.
- [ ] Do not claim guaranteed protection, independent arbitration, insurance or fixed refund times without an approved supported arrangement.

## Formal publication and acceptance rollout

- [ ] Approve exact text, immutable version, effective date and named owner/reviewer for each document.
- [ ] Approve how new and existing users receive notice, and when assent/reacceptance is needed. Do not silently deem existing users to have accepted drafts.
- [ ] If acceptance is needed, design exact-version/timestamp/account records, minimised evidence and purpose separation; justify/test an additive migration after reconciling staging history.
- [ ] Review public contacts, metadata/indexing, accessibility, mobile views and all contextual links.
- [ ] Preserve draft/released history and a rollback/notice plan. Deployment, legal approval, feature activation and cleanup activation are distinct authorisations.

Reopen review for live payments, KYC, uploads, new processors, new countries/jurisdictions, changed retention, fees, arbitration, tracking or moderation processes.
