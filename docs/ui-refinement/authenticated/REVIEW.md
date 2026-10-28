# Authenticated workspace refinement

Review branch: `staging`. No deployment, merge, push, dependencies, migrations, or production/beta data changes.

## Design and interaction changes

| Area                     | Result                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Global design system     | Authenticated-only warm neutral canvas, restrained borders, consistent 14px panels, clearer title/section hierarchy, bounded content width, consistent controls and focus outlines. Public marketplace styling remains independently scoped.                                                                                                                                |
| Sidebar                  | Neutral Hire someone action, quieter marketplace status without a surrounding card, clearer navigation group spacing and restrained indigo selection. Existing routes, account menu, mobile focus trap and Escape behavior remain.                                                                                                                                          |
| Dashboard                | Compact workspace-focus controls, one dominant next action, lighter summary metrics, active work and pending actions before security checks, smaller empty states with Find work/Post a job actions. Removed the duplicate payment warning; the shell status and Payments page retain it.                                                                                   |
| Discovery and job detail | More readable cards, neutral skill chips, calmer filters/saved searches, larger titles and a comfortable scope column. Terms remain a distinct group. The proposal editor no longer occupies the narrow sidebar.                                                                                                                                                            |
| Proposals                | Wide workspace with approach, milestone/delivery/proof, terms and review sections. Compact sticky job context links back to the brief. Milestones have native disclosures with amount/timing summaries; desktop deliverable and acceptance fields share a row. Review receives keyboard focus.                                                                              |
| Job creation             | Existing Describe/Define success/Set terms/Review model retained. Both public listings and direct agreements use the shared milestone disclosure. Progress exposes the current step; all four steps remain on one row and the mobile Continue action gets its own full-width row. Existing draft/save/publish behavior is unchanged. Review retains its existing hierarchy. |
| Profile and editor       | Wider professional content, quieter reputation presentation, grouped editor sections without nested borders, compact readiness percentage/progress and next action, expandable completed/missing checklist. Publication privacy and real reputation data are unchanged.                                                                                                     |
| Portfolio                | One Add project action in the empty state, larger description text and clearer project metadata. The disabled-upload notice appears once for the profile rather than once per portfolio item. Existing project links and stored media remain visible.                                                                                                                       |
| Wallet/security          | Recorded checks appear before ownership, sessions and MFA. Copy message comes first, with success/failure announcements. Exact signing payload is disclosed on demand; signature/public key fields open as needed, including on invalid submission. Expiry and payment disclaimer remain visible.                                                                           |
| Payments                 | Explicit community-beta wording: payments disconnected, funding/payouts unavailable, no balances held. Historical records remain intact; no synthetic financial statistics added.                                                                                                                                                                                           |
| Activity/support         | Compact event rows, readable timestamps, cleaner ticket rows and conversation dividers, readable reply/project copy. Support text replies and attachment-disabled behavior are exercised in browser tests.                                                                                                                                                                  |

## Responsive and accessibility decisions

- Checked 320, 375, 430, 768, 1024 and 1440 CSS-pixel widths. No horizontal document overflow in tested flows.
- Secondary columns collapse at 1100px; mobile gutters are 16px; forms retain the existing 16px mobile input text and touch-sized controls.
- Native `details`/`summary` keep collapsed editors in the DOM, preserving draft values and keyboard access. Existing error-focus behavior opens invalid milestones.
- Existing reduced-motion rules, loading announcements, unsaved-work protection, privacy controls and navigation semantics remain.
- Axe scans cover workspace screens, profile editor, published profile, job review, discovery, proposal editor, wallet signing and support conversation.

## Behavioral changes and invariants

Changes are presentation/interaction only: disclosure state, review focus, clipboard feedback, a brief jump link, compact readiness and removal of redundant notices/actions. No marketplace permission, validation, fee, proposal payload, agreement, privacy, reputation, wallet cryptography or security-rule changes.

The browser server inherits the community-beta configuration: `DEPLOYMENT_STAGE=community_beta`, `IDENTITY_PROVIDER=disabled`, `IDENTITY_SANDBOX_ENABLED=0`, `FILE_UPLOADS_ENABLED=false`. Tests use only the disposable loopback `klaveroq_test` database. Fixture accounts, a listing, a proposal, a concept portfolio and support messages are isolated test records; no completed work, reviews, ratings or payment balances were fabricated. Wallet UI tests intercept only the challenge response to inspect exact payload/copy behavior; they do not pretend to verify a real signature.

## Validation

| Check                      | Result                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `npm run format:check`     | Passed                                                                                       |
| `npm run lint`             | Passed; three existing unused-parameter warnings in `src/server/http/errors.test.ts`         |
| `npm run typecheck`        | Passed                                                                                       |
| `npm test`                 | 231 tests passed across 43 files                                                             |
| `npm run build`            | Passed; production build                                                                     |
| Playwright workspace suite | 8 tests passed (26.8 seconds), including the existing identity-beta and uploads-beta tests   |
| Axe accessibility          | No violations in the tested WCAG 2 A/AA and 2.1 AA scans                                     |
| Responsive checks          | All six requested widths passed; wizard step alignment and mobile action width also asserted |
| Screenshots                | 60 final PNGs: 20 flow/state views at 375, 768 and 1440px                                    |

Final screenshot inspection also caught and resolved a four-step progress indicator using a three-column grid and a cramped mobile Continue action. Screenshot readiness checks now wait for real page content rather than capturing loading skeletons. Existing generated Next.js configuration changes from testing were restored.

Reproduce browser checks from the repository root:

```bash
node scripts/reset-test-db.mjs
node scripts/run-playwright.mjs --config=playwright.workspace.config.ts
```

The reset script guards the disposable test database. Start the repository's `postgres-test` service first. The browser configuration builds the production application before testing.

## Screenshots

Final captures are in [screenshots](screenshots/), with a clickable [gallery](screenshots/INDEX.md). Each captured flow has 375, 768 and 1440px versions. Existing visual snapshot baselines were not overwritten.

## Remaining limitations

- Chromium was used for this milestone; Safari/Firefox and assistive-technology device testing are not claimed.
- Wallet signing was checked at the UI boundary, not against a live wallet extension.
- Long profiles and multi-milestone briefs still require scrolling; disclosures and the sticky proposal context provide navigation without changing their data model.
- Proposal milestone reordering was not introduced: the existing ordered add/remove model and delivery-day validation remain unchanged.
- Existing repository lint warnings in `src/server/http/errors.test.ts` are unrelated to these UI changes.
