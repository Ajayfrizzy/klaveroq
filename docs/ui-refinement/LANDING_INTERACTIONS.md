# Landing interaction refinement

Local work on `staging`, layered onto the existing uncommitted public marketplace implementation. No push, merge, deployment, dependency, schema, migration, or environment changes.

- **Hero:** translucent gradient surfaces, soft inset highlights and controlled shadows preserve the existing product illustration and card layout. A single five-second, three-pixel settling animation stops automatically. Desktop mouse movement adds at most four pixels of drift and 0.45 degrees of extra tilt, with different depths per card. Pointer exit/cancel restores the default composition.
- **Performance:** only two small client wrappers; the hero card content, reputation articles, marketplace queries and page remain server-rendered. Pointer updates use a single pending requestAnimationFrame and CSS properties, without React state updates. Pointer listeners are enabled only for fine-pointer hover devices above 760 px with no reduced-motion preference. No animation framework, WebGL, global pointer handlers, perpetual animation or will-change layers. The new module measures 2,829 bytes minified / 1,259 bytes gzip in an esbuild probe with React external; this is an isolated module estimate, not the complete Next.js route transfer size.
- **Mobile:** compact static layered hero without blur or pointer tracking. Reputation articles use a native overflow track, proximity scroll snapping and a glimpse of the next article. No autoplay or timers. Desktop keeps the original two-column reputation section and vertical article list.
- **Accessibility:** mobile track supports Left/Right/Home/End; three 44 px buttons and a live `1 / 3` indicator reflect the visible slide using IntersectionObserver. Clear focus rings include a light ring on the dark section. Motion preference changes remove pointer offsets immediately and disable float, hover translation and transitions. Navigation retains native details/summary behavior, Escape focus restoration and link activation. Essential content remains available without JavaScript.
- **Marketplace interactions:** restrained card lift, border/shadow changes, arrow movement, button pressed states, secondary CTA tint, navigation underlines, and wrapping for long public preview content. All existing publication rules, anonymous browsing, authentication gates, real reputation values and beta limitations are preserved.

Screenshots use disposable test fixtures, not endorsements or production profiles. They capture the stable reduced-motion frame for review. Browser and validation results are recorded after the final review below.

Validation:

- `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm test`: passed. Unit tests: 43 files / 231 tests. Lint has three existing unused-parameter warnings in `server/http/errors.test.ts`.
- Production `npm run build`: passed as the Playwright server prerequisite with community-beta settings and the isolated loopback test database. No test database reset was needed.
- The new browser test covers 320, 375, 430, 768, 1024 and 1440 px; arrow/Home/End keys and dot controls; stable carousel position without autoplay; mobile menu/Escape focus; desktop non-carousel layout; mouse parallax; changing reduced-motion preference; and hydration/page errors. Axe WCAG 2 A/AA scans accompany the three new screenshot widths.
- Responsive review fixed long preview content at 320 px and the rotated decorative orbit overflowing tablet/small-desktop widths. Removed the redundant hero caption that was obscured by card overlap. Screenshots are reviewed visually, with no visual snapshots automatically approved.

Review captures: [375 px](landing-interactions/landing-375.png), [768 px](landing-interactions/landing-768.png), [1440 px](landing-interactions/landing-1440.png).

Limits: Chromium desktop and resized mobile layouts were exercised; physical-device touch gestures and Safari/Firefox rendering have not been manually reviewed. No production CPU/memory load measurement was performed. The gzip figure above is a module probe, not a before/after production route measurement.

Final browser run: `node scripts/run-playwright.mjs --config=playwright.public.config.ts` — **18 passed, 0 failed (44.7 s)**, including account recovery, preferences, profile publication, marketplace transactions, beta identity/upload restrictions, public visibility, responsive accessibility and landing interactions. The final production build passed in that run. Final `format:check` and `git diff --check` passed. Screenshots at all three requested widths were visually reviewed and saved in this directory. No known blocking issues remain within the tested Chromium scope.
