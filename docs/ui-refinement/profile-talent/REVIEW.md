# Profile and Talent Hub corrections

Implemented the approved screenshot changes on `staging`.

- Skills and spoken-language fields keep inputs above compact removable chips, with useful placeholders and Enter/Add behavior preserved. Populated columns remain aligned.
- Country and timezone use matching searchable native selects. Timezones display city and canonical identifier (for example, Lagos — Africa/Lagos); stored identifiers remain unchanged. Existing identifiers outside the browser's list are retained as selectable values.
- New wallet verification forms start on CKB testnet. Mainnet remains manually selectable. This follows the latest explicit request and replaces the earlier environment-derived UI default; payment/network backend configuration and wallet records are unchanged.
- Talent cards have consistent gaps between identity, skills, location, timezone comparison, availability, portfolio, reputation, explanation, and actions. Narrow layouts wrap reputation statistics.
- The authenticated viewer is excluded in the shared talent listing database query, before sorting/pagination limits. Both the page and listing API use the authenticated session ID. Search/filter result counts therefore exclude the owner. Guests and other accounts can still discover published profiles.
- Profile retains its existing “View public profile” link. Direct public-profile access and backend self-shortlisting protection are unchanged.

Verification: typecheck, formatting, lint, and all 231 unit tests passed. Lint retains three existing unused `_request` warnings. Four focused Chromium/Firefox tests passed, including Axe, profile editing/saving, public preview, owner exclusion across all four sort orders, guest visibility, other-account visibility, and the wallet testnet default. Reflow passed at 320, 375, 430, 768, 1024, and 1440px. The separate public pagination/relevance/publication regression passed.

Inspected profile and talent screenshots at mobile and desktop widths. Four affected Linux Chromium visual references were reviewed and updated; the confirmation run passed. The final production build passed. The visual fixture now browses talent as a different account, matching the new owner-exclusion behavior. Screenshots in `screenshots/` cover the profile editor and populated Talent Hub at 375, 430, 768, and 1440px. Safari and physical-device keyboards were not tested. The visual run logged a Next.js destination-stream-closed message during navigation without a failed assertion.

Tests used only the disposable local test database. No migration, live-data modification, push, merge, or deployment was performed.
