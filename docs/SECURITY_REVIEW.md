# Security Review

Review date: 2026-09-25. Scope: Phase 7 application code and local operational configuration.

## Resolved

- State-changing browser routes enforce same-origin checks and authenticated ownership/role checks.
- Sessions use random hashed tokens with `HttpOnly`, `SameSite=Lax`, production `Secure`, explicit
  expiry, revocation, and account-status enforcement.
- API requests now carry UUID correlation IDs without trusting arbitrary header content.
- Audit metadata redacts secret, identity, address, email, message, note, and reason fields.
- Password/MFA/token material is hashed or encrypted and never returned after setup where avoidable.
- File uploads use content-derived type checks, quarantine-first storage, malware scanning,
  clean-only reads, size/count bounds, randomized storage keys, and authorization checks.
- Global headers deny framing and MIME sniffing, restrict referrer/device capabilities, isolate the
  opener, and enable HSTS in hosted production.
- Production readiness fails for insecure URL/session secret, local email, sandbox identity, local
  scanning, missing MFA encryption, or weak/missing cron credentials.
- Retryable creates/messages have actor-scoped validated idempotency keys; delivery dedupe keys and
  conditional state transitions cover background and agreement mutations.

## Remaining release gates

- Add a nonce-based Content Security Policy after validating every Next.js script/style/media path;
  a static CSP was not added because it would either break hydration or require unsafe inline rules.
- Run dependency vulnerability scanning in Phase 8 CI. The Phase 7 scan upgraded Next.js to
  16.3.6, Sharp to 0.35.4, PostCSS to 8.5.23, NanoID to 3.3.19, and the test toolchain. It reports
  no high or critical production advisory.
- Configure production Resend, identity, ClamAV, storage, monitoring, secret manager, backup
  encryption, and infrastructure access controls; local adapters are not production-safe.
- Exercise account closure after legal-hold and PactAgent checks exist.
- Perform external penetration testing before handling production funds or identity verification.

No unresolved high-severity application finding was identified in this pass. External-provider and
infrastructure controls remain explicit release gates, not assumed capabilities.

The remaining production audit result is four low-severity reports for `elliptic`, transitively
included by `@ckb-ccc/core` through JoyID. npm proposes an unsafe forced downgrade to a pre-1.0 CKB
package, so it was not applied. Wallet verification fails closed, authorizes ownership only (never
payment), and must be retested when the upstream dependency publishes a compatible fix. Development
tooling also retains moderate advisories in Drizzle Kit's unused local esbuild loader; it is not
shipped in the production application.
