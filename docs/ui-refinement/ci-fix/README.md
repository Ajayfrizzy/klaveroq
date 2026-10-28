# Browser CI regression repair

The Docker image pull completed successfully. The failing job had three test integration issues after the authenticated UI refinement:

- `authenticated-workspace.spec.ts` was picked up by the development suite on port 3199, although its requests use the beta origin on port 3201 and assert uploads are disabled. Registration correctly returned 403 for the mismatched origin. Exclude these tests from the base suite and include them in the beta suite already invoked by `test:e2e`; no origin/security checks were relaxed.
- The wallet security journey tried to fill the now-collapsed signature fields. Open the disclosure before filling them, retaining the real cryptographic signing and replay/boundary assertions.
- The Linux visual references still represented the previous workspace. Reproduced with `mcr.microsoft.com/playwright:v1.63.0-noble`, inspected the actual captures, then replaced the 26 affected Linux baselines. Screenshot tolerances and assertions are unchanged. macOS baselines were not changed in this Linux CI repair.

Verification uses a temporary repository copy and the disposable loopback `klaveroq_test` database. No production data, deployment settings, application behavior, or dependencies changed.

The full-suite reproduction also exposed an order-dependent homepage assertion: daily discovery can rank an experienced professional created by another test first. The test now verifies every displayed card's completion count against the isolated database instead of assuming the first result is new. This preserves the real-reputation assertion without imposing a false ranking requirement.

The beta stage then exposed one more stale UI assertion in dashboard smoke: the redundant in-page payment notice was removed during refinement. The smoke test now checks the persistent sidebar notice instead, retaining payment-availability coverage and its navigation/reload checks.

Validation:

- Linux development suite: 52 passed, including visual references, real wallet signatures and Firefox/WebKit smoke checks.
- Linux beta suite: 11 passed after the dashboard-smoke correction; all six workspace journeys now run here. Both stages build the production app before execution.
- Unit suite: 231 passed across 43 files.
- Typecheck and formatting passed. Lint passed with the same three pre-existing unused-parameter warnings in `server/http/errors.test.ts`.
- Test discovery explicitly verified that no workspace journey remains in the development suite and all six appear in the beta suite.

No push, merge or deployment was performed.
