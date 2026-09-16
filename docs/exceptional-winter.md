# One complete winter — implementation and review

## Baseline and plan

The default branch is behind shipped work. PRs #8, #9 and #10 remain open, but later branches descend from them. This branch preserves `preview/0.3-make-it-yours` and merges `fix/social-preview` (including production mobile onboarding and analytics). Production routes, database bindings, and deployment configuration are unchanged.

Plan: connect guest outcomes to future audiences; give growth a capacity consequence; provide explicit recovery; turn the journal/postcards into a factual season history; compare seeded strategies and verify the UI on a separate preview.

## Experience

- Opening: the journal offers staffed rentals or rentals plus teaching. These compose the existing building/staffing actions, disclose capital and wages, open the starter lift, and reject atomically when unaffordable. All ordinary build controls remain available.
- Guest satisfaction by ability feeds a bounded audience memory. Five departures are required to update a cohort. This changes future skill mix and demand, without consuming random draws. Terrain and services still determine actual satisfaction.
- Every promotion now obeys arrival capacity. Morning admissions can cap bookings at 70% of arrival spaces, trading sales for breathing room without a free satisfaction bonus.
- Three days of substantial unmet physical arrival demand record an access setback. The last seven days of unmet demand reduce resident support for more inns, capped at 12 points. Transport and housing retain their existing council benefits. The player can resolve the shortage by expanding access or reducing demand; recovery also requires positive operations and 65% satisfaction.
- Emergency resurfacing moves stored snow to one thin run per morning for $2,400. It adds 16 cm, is charged/expensed once, and does not override manual or avalanche closures. The player must review and reopen the run. Warmth can melt it again.
- The closing-week prompt points to the existing hosted events. Lessons, qualifying laps, visitors and satisfaction determine success. The final report includes actual route diagrams before/after, cash change, operating profit, audience outcomes, event results and recorded decisions/setbacks. Old saves start honest history at their current day.
- Save v17 migrates active/inactive resorts. Opening geometry is copied, not referenced. Sandbox rollover resets the current journal; archived season postcards retain a copy of it.

## Art and controls

Retain the mountain's existing world scale (2 m per unit), regional materials, isometric buildings, cool snow/warm occupied windows, directional shadows and restrained glass UI. Do not add another camera or perspective. New route portraits use actual topology and the existing difficulty colors, and are explicitly labelled diagrams.

Skier render smoothing projects back onto its own piste so sharp bends do not send bodies across terrain. Carving width is bounded by piste width; pose animation follows simulation time. Lodge gathering figures now correspond to nearby eating/resting guests instead of sampling overall resort attendance. Existing lift movement, weather, regional scenery, rescue animation, town construction and village journeys are preserved.

## Reproduction

- `npm ci && npm run build && npm test`
- `npm run playtest:winter`: nine 60-day scenario runs, three strategies × seeds 11/42/91, real starting funds and weather; produces `docs/winter-balance.md`.
- `npm run playtest:showcase`: generates five seed-91 snapshots under ignored `public/winter-review/`: original opening, busy day 25 at 11:00, controlled thin-cover recovery, day-54 finale and day-60 ending.
- `npm run dev -- --host 127.0.0.1`, then `/scripts/winter-review/index.html`. The review bench loads scenes paused, freezes feedback state, exports feedback plus exact state/seed/build ID, and restores matching-build captures. Test saves use a dedicated import slot.
- `npm run build:review` builds the optional review entry. The ordinary build does not include that entry.

The source fingerprint covers tracked and untracked TS/TSX/CSS/JSON/HTML source (excluding ignored generated fixtures); it accompanies the Git commit. Keep a reviewed build unchanged while collecting feedback. A feedback note never uploads itself anywhere.

`@kenny/playtest-kit` was absent from all inspected package manifests and inaccessible on npm (404). Existing headless probes and review pages were retained. The new bench does not claim SDK compatibility.

## Remaining limits

The strategy probe is heuristic, not an optimizer. Conditions can be prevented entirely by good management; there is no mandatory scripted punishment. A well-equipped resort remains economically generous, and satisfaction is often high. Guests have ability-dependent goals but do not move as linked parties. Village journeys remain an authored representation, not continuous navigation between town and mountain. Mountain construction is immediate; town construction takes operating days. No new sound system or destructive avalanches were added. Physical touch devices and cross-browser performance require separate verification.

Production deployment is a separate step. No PR merge or production promotion is part of this work.
