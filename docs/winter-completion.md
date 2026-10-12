# Winter completion pass

This supersedes the unresolved first-pass notes in winter-browser-review.md. Production remains unchanged.

## Economy and experience

The prior release rewarded the same positive memories over and over and had almost no visitor-dependent costs. Positive memories now diminish with repetition, positive satisfaction approaches 92 rather than receiving an always-positive floor, and repeat laps have diminishing benefit. Complaints retain their full weight. Staffed teaching on open green terrain attracts up to 20% extra demand.

Visitor services cost $18 per actual arrival, reduced by the existing employee-housing discount. Supplies cost 40% of food sales, 20% of rental sales and 10% of lesson sales. These are charged once at settlement, shown separately in the report, and included in operating profit. The journal shows the next-day service forecast before committing to admissions. Chair maintenance is $1,400/day (high-speed $2,400, gondola $3,800); the starter surface lift remains $90. Larger terrain operations now carry larger fixed commitments.

Save v18 preserves old reports without inventing expenses and migrates active and inactive resorts. No saved money, buildings, controls or weather are reset.

Nine complete 60-day scenario runs passed (seeds 11/42/91):

| Approach | Ending cash | Mean daily satisfaction | Tradeoff |
|---|---:|---:|---|
| Learners | $258,006–$323,269 | 73.6–79.2% | Strong cash without an early loan; less terrain variety |
| Terrain | $256,576–$337,977 | 75.1–82.7% | More guests and runs, debt and higher fixed costs; race missed in one seed |
| Village | $34,416–$62,522 | 72.9–76.2% | Four public upgrades, smaller cash reserve and later mountain expansion |

Learners beat terrain cash in two of three seeds. Terrain retains the largest attendance. Village investment is viable but substantially less liquid; these are explicit heuristic policies, not optimized strategies or proof of global balance. All survive to day 60. All learner/festival finales succeed; one race misses. Detailed rows remain in winter-balance.md.

## Feedback and replay

Captures copy the state before asynchronous work, retain exact build and seed, and include a SHA-256 state checksum. Same-build imports reject altered captures. The download link remains valid until replaced or unmounted, rather than revoking immediately after a synthetic click. Both file input and paste restore share the same validator; imported state is compared to the captured checksum in the UI.

Browser verification: froze day 1 at 08:30, seed 91; loaded the day-35 resort with 405 guests; pasted the saved capture back and obtained `exact state MATCH` with checksum prefix `951ef1cbb41d`. A unit test also advances both original and restored RNG states through the same complete day and asserts equality. Mismatched builds and modified state are rejected.

The cloud browser's native download and file-picker event hooks timed out. The copyable-capture route is browser-verified and is a supported fallback, not a claim that native picker interaction was verified. The JSON copy was saved as a local file during the check.

## Phone controls

The review page now offers 390×844 and 360×844 iframe viewports, using the actual app CSS/media queries. At 390 pixels, purchased rentals and school, opened and ended day 1, scrolled the report and proceeded to day 2. Result: 149 arrivals, 69.4% satisfaction, $6,744 operating profit, $51,744 cash. No free money or special test economy was used.

At that width, selected the trail tool, placed two waypoints, inspected the $7,804 estimate and inaccessible/dead-end warnings, undid one point and cancelled without spending. The panel correctly closes when a phone build tool is selected. Narrow-screen buttons now have a 44-pixel minimum height.

The real canvas listeners passed synthetic touch tests for tap placement, drag without placement, pinch without placement, pointer cancellation, and the next tap after cancellation. Fixed the missing pointercancel cleanup so interrupted gestures cannot leave a stale touch ID. This is explicit event-path coverage; no physical iPhone/Android hardware was available.

The final 360×844 check also passed: the journal fits the viewport, its content scrolls, the larger investment buttons remain readable, and purchasing rentals plus teaching debited exactly $35,000 before closing back to the mountain. Screenshot: [360-pixel journal](evidence/completion-phone.jpg).

## Performance and build evidence

The cloud browser measured 59.9 FPS on the menu (600 frames, median/p95 16.7 ms), but approximately 1 FPS on both an empty paused mountain and a busy 409-guest mountain (11 frames over ten seconds, median/p95 approximately 1,016 ms). A completely independent 64×64 WebGL canvas that only clears one color, with no Pixi, mountain or simulation, reproduced the same 1 FPS cadence. This isolates a graphics-host scheduling limitation; it does not establish game frame rates on player devices.

Busy scene-update CPU p95 was 6.2 ms versus 1.0 ms empty in one instrumented sample (15/17 samples respectively). Samples are sparse because of the host limitation and exclude GPU/compositing work. Removing HUD blur did not change the cadence, so that experimental change was reverted. Smooth physical-device performance remains unverified; the review bench retains repeatable timing and independent-control tools for that check.

Final browser build: `2acd4ae-ae76788f8cdf`; temporary preview https://summit-completion-5.basalt-midnight.workers.dev/scripts/winter-review/ (expires). Source fingerprint is computed from the working source, including uncommitted changes; the prefix is the local parent commit, not a claim those changes were already committed. This build includes the final narrow buttons and original HUD appearance. Earlier capture roundtrip was on completion build `2acd4ae-c957b8c3fe27`; busy timing on `2acd4ae-6fd6c216b435`. No recording capability was available.

## Verification

180 tests in 25 files passed, plus nine full-season runs (540 days). Production and review builds, review TypeScript check, worker typecheck and lint pass. Lint retains two existing Fast Refresh warnings; Vite retains its large-chunk warning. Optional timing instrumentation never enters simulation state or a save.

Reproduce with `npm ci`, `npm test`, `npm run playtest:winter`, `npm run playtest:showcase`, and `npm run build:review`. Run `npm run dev` and open `/scripts/winter-review/index.html` for replay, responsive checks, touch-path checks and measured frame times.
