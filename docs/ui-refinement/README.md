# Beta UI/UX refinement — September 28, 2026

## Audit and implemented changes

The existing four phases already provided signed-in marketplace navigation, removable filter chips, saved searches, genuine empty states, local shortlists/comparison, guarded profile publication, next-action guidance and unsaved-form warnings. These were retained rather than rebuilt.

The rendered audit found defects not evident from those completion checklists:

- **Discovery:** expanding Talent's advanced filters stretched peer controls to the height of the entire nested section. Advanced filters now occupy a separate full-width grid row; shared controls remain 44px high and Apply/Clear have their own action row.
- **Tablet layouts:** Dashboard, Jobs and Support overflowed at 768px. Intrinsic grid sizing, fixed column minimums, headers and toolbar wrapping were corrected. Secondary profile/security/support columns now stack before they become cramped.
- **Dashboard:** focus choices explain hiring, working and both; complete published profiles receive a quieter panel. Actual job/action metrics and funding limitations are preserved.
- **Profile:** the header clearly labels public/private status. The real upload control now has a styled keyboard-accessible picker and local image preview before upload, retaining upload progress, replace/delete and persisted-media behavior. Existing section navigation, private saves, publication validation and portfolio management remain.
- **Activity/security:** canonical event mappings replace raw event names in both feeds. Account activity retains identifiers in expandable technical details and links only to authorized account workspaces. Device/browser summaries replace raw user-agent strings; details remain available. Feed timestamps use explicit UTC consistently.
- **Payments:** a single precise network-availability explanation replaces repetitive unavailable summary cards on empty accounts. Accounts with payment records still show actual aggregates; transaction references are secondary details. No reconciled balances or payment settlement are claimed.
- **Notifications/support:** security notifications have a distinct icon/category; read status is explicit. Network failures recover with feedback. Untouched forms no longer display “No unsaved changes.” Unpublished guide topics no longer look like active article links.
- **Mobile/accessibility:** bottom-navigation labels are larger and meet contrast requirements; the icon-only Dashboard link has an accessible name. Existing focus traps, nested-route highlighting and scrollable sidebar are retained.
- **Development issue indicator:** Find Talent rendered sibling components with identical account/guest keys. The keys now identify the component as well as the account. A separate screenshot-harness hydration warning was traced to capturing before hydration while Playwright temporarily hid carets; captures now wait for client account initialization and preserve caret styling. No overlay is hidden through CSS.
- **Evidence-form initialization:** the broader Linux run exposed an early-input race: typing before hydration could leave React with an empty evidence note when a file was selected. Evidence controls now remain disabled until their handlers are ready, preserving the first edit. The regression explicitly checks that the note survives file selection.

## Before and after evidence

These captures use a new isolated review account, not the owner's account. Empty marketplace screens reflect genuinely empty public listings/profiles in that review database. Each directory contains all ten pages at 375, 768 and 1440px. Production visual references additionally cover no-match searches, a persisted public talent result, profile editing/upload preview and invalid job forms.

| Page | Before (desktop) | After (desktop) | Tablet after | Mobile after |
| --- | --- | --- | --- | --- |
| Dashboard | [Before](before/dashboard-1440.png) | [After](after/dashboard-1440.png) | [768px](after/dashboard-768.png) | [375px](after/dashboard-375.png) |
| Find Work, expanded | [Before](before/discover-1440.png) | [After](after/discover-1440.png) | [768px](after/discover-768.png) | [375px](after/discover-375.png) |
| Find Talent, expanded | [Before](before/talent-1440.png) | [After](after/talent-1440.png) | [768px](after/talent-768.png) | [375px](after/talent-375.png) |
| Jobs | [Before](before/jobs-1440.png) | [After](after/jobs-1440.png) | [768px](after/jobs-768.png) | [375px](after/jobs-375.png) |
| Payments | [Before](before/payments-1440.png) | [After](after/payments-1440.png) | [768px](after/payments-768.png) | [375px](after/payments-375.png) |
| Activity | [Before](before/activity-1440.png) | [After](after/activity-1440.png) | [768px](after/activity-768.png) | [375px](after/activity-375.png) |
| Notifications | [Before](before/notifications-1440.png) | [After](after/notifications-1440.png) | [768px](after/notifications-768.png) | [375px](after/notifications-375.png) |
| Wallet & Security | [Before](before/wallet-1440.png) | [After](after/wallet-1440.png) | [768px](after/wallet-768.png) | [375px](after/wallet-375.png) |
| Profile & Portfolio | [Before](before/profile-1440.png) | [After](after/profile-1440.png) | [768px](after/profile-768.png) | [375px](after/profile-375.png) |
| Support | [Before](before/support-1440.png) | [After](after/support-1440.png) | [768px](after/support-768.png) | [375px](after/support-375.png) |

## Verification and remaining gates

The complete Linux acceptance suite passed **39/39 tests** with snapshot updating disabled, covering Chromium, Firefox, WebKit and mobile projects, database integrations, authentication, uploads and agreement/dispute workflows. Production build, lint, TypeScript, formatting and **114 unit tests across 27 files** passed.

Twenty main-page desktop/mobile Axe audits reported zero violations. Responsive checks covered all ten routes at 320, 375, 768, 1024 and 1440px; keyboard navigation, 200% zoom and reduced motion were also exercised. No reproducible visual defects remain in these audited scenarios. Automated checks are not a substitute for the remaining manual screen-reader review.

This UI scope is ready for staging review. Rapid test navigation occasionally produced Next.js “destination stream closed early” server logs; the visual tests reported no browser console errors.

Visual references live in `apps/web/tests/e2e/beta-refinement.spec.ts-snapshots`: 26 scenarios each for macOS and Linux, covering the ten main pages plus populated Talent, profile editing/upload preview and job validation at desktop/mobile widths. Variable account identifiers and timestamps are masked only in regression references; the before/after delivery captures are unmasked. References were visually reviewed and then compared with snapshot updating disabled.

The suite's clean-database preflight and retention-count assertions require a fresh isolated database for each complete run. To honor the no-reset requirement, this review used new local `_test` databases initialized with existing migrations, and invoked `scripts/run-playwright.mjs` directly rather than the resetting npm wrapper. Reusing populated suite databases is not a valid full-run setup.

The Linux run uses the pinned `mcr.microsoft.com/playwright:v1.63.0-noble` image to match the CI browser environment. `scripts/run-browser-container.mjs` forwards only the isolated app/test-database ports; `PLAYWRIGHT_EXTERNAL_SERVER=1` explicitly opts out of starting a second app server. The normal Playwright command still builds and starts production itself. Firefox's native macOS binary could not initialize its temporary profile, including a fresh download; Firefox was verified in Linux instead. This is a local tooling limitation, not a passing macOS Firefox claim.

### Account-menu visual regression follow-up

CI now runs the browser suite inside that same pinned Playwright image, with a separate Linux dependency installation. Previously, CI installed browsers directly on `ubuntu-latest`, while the Linux references came from the container. The differing system font environments produced text and page-height mismatches: the reported mobile failures pass against the original references inside the pinned image. Keep the image version aligned with the Playwright version in `package-lock.json` when upgrading.

The desktop references were refreshed for the approved avatar/name account menu replacing the settings/logout icons. Mobile references and screenshot comparison tolerances remain unchanged. Review actual/diff artifacts before updating references; do not update them automatically in CI.

Final local verification passed all **40/40 tests** in the pinned Linux browsers with snapshot updating disabled, using a newly created isolated database. This also exposed and fixed a timing-dependent accessibility failure in the notification loading placeholder: it now has a `status` role, and the loading-state test checks that role explicitly. The production build and targeted lint/format checks passed. The updated GitHub workflow still needs its normal hosted run after these changes are pushed.

Agreement-test browser/API contexts now close after each test. This prevents accumulated sessions from affecting later verification.

No existing database was reset. The empty local test database was initialized using existing migrations; separate refinement/acceptance databases were created for the regression suite's empty-database dependency. All fixture changes are restricted to those isolated databases on the local test container (port 55434). Google authentication, Supabase, PactAgent and the owner's development server/data were not changed. Nothing was committed, pushed or deployed.

Saved searches, shortlist IDs and workspace preferences remain account-scoped on the current device. Unsaved form content is held in memory, not autosaved; browser-history navigation remains a documented limitation. Real Google/email/identity providers, browser-wallet certification and manual screen-reader checks remain the existing staging gates.
