# Authenticated UX corrective pass

Review-only changes on `staging`. No push, merge, deployment, migration, or live-data changes.

## Validation and focus

Proposal, public-job, and direct-agreement validation share `useWorkProtection`. Each validation attempt triggers the existing post-render effect, including when the error text is unchanged. The effect finds the first invalid field in document order, opens its ancestor native disclosures, scrolls it to the center clear of fixed navigation, and focuses it without another scroll. It falls back to the error summary when no invalid field is mounted. Successful validation does not move focus through this effect. Editing does not repeatedly steal focus.

Public-job milestone fields now expose `aria-invalid`; proposals also expose invalid delivery timing. Existing title, deliverable, acceptance, amount, timing, proof, and ordering rules are unchanged. Public jobs specify the budget separately rather than a per-milestone amount. Other disclosures remain in their current state and mounted values are retained.

Browser regressions exercise repeated identical errors, each proposal field, public-job timing in a second closed milestone, preservation of the valid first disclosure, saved values, and successful review/submission. Mobile assertions verify focused fields clear fixed navigation. Direct-agreement coverage verifies reveal, focus, and retained values.

## Wallet and dashboard

Account security and email checks lead Wallet & Security, followed by MFA, sessions, identity, and wallet ownership. The sign-in summary remains a desktop sidebar and appears before the forms on narrow screens.

Before a beta signing challenge, visible text explains that verification is optional, email/Google remains primary, and ownership does not activate payments, balances, funding, payouts, or payment protection. The purpose selector is hidden in beta; the existing `BOTH` value is retained and described as future intended use. Existing record/default controls use future-use labels. Signature verification, stored semantics, and security holds are unchanged.

The server passes a network default derived from `CKB_NETWORK`: explicit `mainnet` uses mainnet; otherwise the default is testnet. Beta tests explicitly configure testnet. Users can still select either supported network. No deployment configuration was changed.

A saved workspace focus plus a publication-ready profile or active agreement history enables “Current focus · Change”. All three choices and the existing preference API remain available. New/incomplete accounts retain onboarding. Saving leaves the selector expanded so the focused control does not disappear. The beta dashboard now describes wallet ownership as optional instead of asking users to finish it as account verification.

Screenshot review also found mobile proposal-review buttons inheriting a 180px vertical flex basis. A scoped correction restores normal control height; tests cover 375px and 430px.

## Verification

- `npm run format:check`: passed.
- `npm run lint`: passed; three existing unused `_request` warnings in `src/server/http/errors.test.ts`.
- `npm run typecheck`: passed.
- `npm test`: 231 tests / 43 files passed.
- `npm run build`: passed locally; production builds also passed in the Linux browser harness.
- Authenticated workspace: 14 tests passed across Chromium and Firefox, including identity-disabled and uploads-disabled checks in Chromium.
- Final focused proposal rerun after the CSS correction: Chromium and Firefox both passed.
- Existing Linux Chromium reference tests: 2 passed (20 screen comparisons); real wallet-signature, identity, and session-security workflow: passed.
- Axe WCAG 2 A/AA and 2.1 AA: no violations in the audited workspace states, including invalid forms, wallet signing, and compact dashboard.
- Responsive reflow: no horizontal overflow at 320, 375, 430, 768, 1024, and 1440px.

Testing used Playwright 1.63.0 in its Linux container and the disposable loopback `klaveroq_test` database. Beta browser configuration retained `community_beta`, identity disabled, sandbox identity off, uploads off, and testnet. No beta/live database was reset or seeded.

## Visual evidence and limits

[Snapshot index](screenshots/INDEX.md) contains 40 Chromium captures at 375, 430, 768, and 1440px, including every requested state. Mobile and desktop captures were visually inspected; the established dashboard is compact, invalid disclosures expose errors and retained values, wallet content remains readable, and the desktop wallet keeps its two-column structure. Full-page mobile screenshots include the fixed bottom navigation at the initial viewport boundary; focused-field visibility is checked separately in the browser.

Only the two Linux wallet visual baselines changed in the existing development-mode reference suite. They were inspected before replacement; the other 18 main-workspace reference images matched. That suite intentionally uses development identity/upload settings, while the corrective screenshots use community-beta restrictions.

Safari/WebKit and physical-device keyboards were not tested in this pass. Existing macOS screenshot baselines were not regenerated. Some rapid-navigation beta tests logged Next.js “destination stream closed early” messages without failed assertions or visible error screens; those framework abort logs remain a diagnostic limitation.
