# Milestone 1: authentication UX refinement

Branch: `fix/m1-auth-onboarding-ux`, based on updated `origin/staging` at `1fe3ab6`.

## Before and after

Previously registration led to an editable email form headed “Verify your email”,
with “Send a new link” as the primary action. The handoff now says “Check your email”,
shows the recipient as read-only text, explains opening the emailed link, and offers
spam-folder advice and a secondary resend button. Failed initial delivery and retries
show failure text and a usable retry action. Token verification, success, invalid and
expired states retain their continuation links. Visitors opening a token without an
email address can still enter an address to request another link.

Resend now exposes delivery success/failure only to the signed-in account owner.
Anonymous callers and callers requesting another account retain the same generic
response regardless of account existence or delivery outcome. Their UI acknowledges
the request without claiming that a message was sent. Origin checks, rate limits,
token rotation, audit events and local-token restrictions remain in place.

Registration and password reset show guidance before typing and subtle live minimum-
length feedback. Requirements remain 12–128 characters, including uppercase and
lowercase letters and a number. Browser validation matches those requirements;
server-side validation remains authoritative. The registration show/hide control is
preserved. Guidance is associated with the input using `aria-describedby`.

## Files changed

- `apps/web/src/features/auth/components/auth-form.tsx`
- `apps/web/src/features/auth/components/verify-email-form.tsx`
- `apps/web/src/features/auth/components/reset-password-form.tsx`
- `apps/web/src/features/auth/components/password-guidance.tsx`
- `apps/web/src/features/auth/password-policy.ts`
- `apps/web/src/features/auth/password-policy.test.ts`
- `apps/web/src/server/auth/schemas.ts`
- `apps/web/src/app/api/auth/verify-email/resend/route.ts`
- `apps/web/src/app/api/auth/verify-email/resend/route.test.ts`
- `apps/web/src/styles/product-experience.css`
- `apps/web/tests/e2e/auth.spec.ts`
- `apps/web/tests/e2e/auth-ux.spec.ts`
- This report and four screenshots in this directory.

## Validation

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run format:check`: passed.
- `npm test`: 266 tests passed across 47 files.
- `node scripts/run-playwright.mjs tests/e2e/auth.spec.ts tests/e2e/auth-ux.spec.ts --project=chromium --no-deps`:
  all 7 tests passed after correcting an overly broad test alert selector.
- `tests/e2e/client-invites.spec.ts`: all 5 tests passed in the initial combined browser run,
  including registration/verification continuation at desktop and mobile widths.
- Production `npm run build`: passed as part of the Playwright web-server setup.
- Axe checks on registration, email handoff and reset: no violations in the tested main regions.
- Keyboard password visibility and resend actions passed; mobile handoff overflow check passed.
- Actual local verification tests cover single use, rotation, invalid/expired tokens,
  reset, session revocation and login. New unit tests cover policy boundaries,
  delivery failures/retries and non-disclosure of other accounts' delivery results.

Only the disposable PostgreSQL database on loopback port 55434 was reset/migrated.
No application migrations were created. No hosted database or secrets were changed.
No deployment, push or merge was performed. Unrelated local `.env.example` and
`deploy/rumptycloud/` edits were excluded from the commit.

## Screenshots

Synthetic test account; screenshots reviewed visually.

| View | Registration | Email handoff |
| --- | --- | --- |
| Desktop, 1280 × 900 | [Registration](desktop-registration.png) | [Check your email](desktop-check-email.png) |
| Mobile, 390 × 844 | [Registration](mobile-registration.png) | [Check your email](mobile-check-email.png) |

## Limitations

Live email-provider delivery was not exercised. Provider success/failure is tested with
mocks; real local auth flows use the existing simulated delivery provider. “Sent” means
the provider accepted the message (or reported delivery), not a guarantee of inbox
placement. Anonymous resend deliberately cannot reveal delivery failures for a
particular account. Browser validation was run in Chromium, including mobile viewport
coverage; physical devices and other browser engines were not exercised.

Existing persistent instructions already cover invitation return paths and security;
no new persistent instruction was necessary.
