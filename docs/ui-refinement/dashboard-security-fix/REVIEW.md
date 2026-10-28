# Dashboard and security layout fix

Scope: only the hidden dashboard actions and Wallet & Security layout/copy identified in the screenshot review.

- Dashboard hides only the focus selector. Next-step description and action links stay visible when “Change” is collapsed.
- Wallet & Security uses balanced desktop columns: sign-in summary, MFA and sessions on the left; wallet verification and records on the right. Narrow screens stack the groups in security-first order.
- Removed the duplicate identity panel; the identity status and header action remain.
- Increased the account security summary's text size and made the beta Network control span the form width.
- Accounts without a local password get accurate authenticator setup wording; password-based accounts retain their existing instructions and password field.

No account data, authentication rules, wallet verification logic, network defaults, marketplace/profile behavior, or unrelated page styles changed. The no-password fixture modifies only its own disposable test account.

Validation: typecheck, format check and lint passed (three existing unused `_request` warnings). Four focused Chromium/Firefox tests passed, including Axe, collapsed dashboard action visibility, one Manage identity action, full-width beta network field, and no-password MFA presentation. Production builds passed in the Playwright harness. Reflow checks include 375, 430, 768 and 1440px. No Safari test was run.

Screenshots alongside this report show the established dashboard and beta wallet page at all four widths. Mobile and desktop images were inspected. Only the two existing Linux wallet visual baselines required updates; the other main-workspace comparisons matched.
