<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Client Invites domain rules

- Client onboarding lives in `features/client-invites`; `client_invites` is not a project or
  permission grant. Accounts may both hire and work; workspace focus is not an authorization role.
- Only active, verified users create/respond. Recipient email must match the authenticated verified
  email. Never expose invitation message, recipient email, or private project data to anonymous users.
- Tokens are 32 random bytes, stored hashed, expire in seven days, and are single-use. Resend rotates
  tokens. Serialize response/resend/revoke with row locks; enforce owner and recipient constraints.
- Use the existing email outbox/provider, rate-limit storage, transactional audit and notification
  records. CLIENT_INVITE deliveries validate their live token and recipient JOB email preference;
  their userId identifies the sender because recipients may not have registered yet. Scrub raw links
  after delivery, response, revocation, rotation, or expiry. Never log raw tokens or personal messages.
- Accepted invitations retain dashboard Create Agreement actions until linked to a job. Create
  Agreement is primary; Post Public Job is secondary. Normal client features remain available.
- Reuse JobWizard, createJobSchema, jobs and milestones. Derive and enforce the freelancer from the
  accepted invitation server-side, including private profiles. Lock the invitation during job creation
  and reuse its existing job on concurrent requests. Do not create parallel agreement entities.
- `jobs.termsAcceptedAt` records freelancer consent only for invitation-linked agreements. It does
  not change financial status, start milestones, require a wallet, or invoke funded acceptance.
- Invitations and agreement creation are free. Preserve fee estimates/rules and PactAgent boundaries;
  never initiate payment/escrow on invitation or terms acceptance and never introduce proposal fees.
- Test with the isolated loopback `_test` database. Generate migrations with Drizzle; do not edit
  generated SQL/snapshots. See `docs/CLIENT_INVITES.md` for validation and operational limitations.
- The existing `/api/internal/notifications/retry` maintenance endpoint materializes invitation
  expiry and records system audit events; authorization always checks the deadline directly.
  Verification emails must preserve safe `returnTo` destinations, including verification resends.
