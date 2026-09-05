# Preproduction release review — September 5, 2026

Candidate: `44a0651c-61a1-4433-b107-5eece3b3e8e8`

Preview: https://preproduction-summit-snow.kennyatx1.workers.dev/?v=44a0651c

## Included work

Verified each open PR head is an ancestor of this branch:

- PR #8, mountain identities: `add230bdf928e0d746eb67942a79228b54150555`
- PR #9, night skiing and alpine operations: `57a21743ba37b565bc43221aa16bffbf5559a8e6`
- PR #10, town council and villages: `965fdd0bc1d2e38dd4b071ac02fda4c53d168e37`
- Issue #7: serious-incident animations and helicopter evacuation charges, implemented in `6873346` with simulation/save tests. No serious incident occurred in this manual playthrough; existing automated rescue tests passed.

PRs remain open. This review did not push commits, merge PRs, close issues, or change production.

## Fixes found in this pass

- Continue season now opens the most recently saved game, including a newer manual save or a manual-only game. Previously it always selected autosave.
- Moved housing, its fence, the market plaza boundary, and a roadside pine away from the curved road. Adjusted pedestrian foot anchoring and the Main Street ribbon ceremony to stay clear of traffic.
- Corrected sentence capitalization and number agreement in new guest reviews, plus the construction countdown's singular day label. Existing saved review text is preserved.
- Added a local visual review page at `/scripts/release-review/index.html` when running the Vite development server. It renders real TownScene components at levels 0–3, with construction and dusk controls; it is not a production entry point.

## Verification

- 135 unit/simulation/save tests pass across 15 files.
- Extended expansion playtest: 8 tests pass, covering all eight mountains; updated `expansion-playtest.md` records the results.
- Production TypeScript/Vite build passes. Lint reports only the two pre-existing Fast Refresh warnings in TopBar and shared components. Vite retains its existing main-bundle size warning.
- Visually inspected all eight towns at levels 1, 2, and 3; inspected shared construction geometry and dusk rendering. This is a targeted visual check, not exhaustive coverage of every mixed-level combination.
- Browser checks at 390×844, 768×1024, and 1280×900: mobile council proposal/save controls and events; tablet build, staff, pricing, finance, resorts, views, all bottom drawers, guest inspector, and day-end report; desktop town layout and save reload.
- Played Prairie Knob from Day 5 to Day 8. Started housing construction through the mobile council, operated Day 5 live through early afternoon, then used End day (the normal simulation loop) to close it and subsequent days. Night operations were enabled. Checked day-end finances, construction countdown, event choices, housing opening, ceremony, and scrapbook entry.
- Day 8: housing level 1, 3.5% staffing discount, six scrapbook entries, $271,567 cash. Saved and reloaded successfully through Continue season after updating the preview.
- No browser console errors observed in the checked release candidate.

## Remaining limits and release procedure

No blocking defect was found in the checked flows. Browser coverage is Chromium through the Codex browser; native Safari/Firefox and physical touch devices were not tested. This pass is not a frame-rate benchmark. Expansion balance remains strategy-dependent, especially snow recovery at Alder and Mont Blanche; see the existing expansion/snow-recovery reports.

Current production remains version `dbdf6473-02ac-4107-a21f-dd6a76eb8548`, verified with `wrangler deployments list`. Keep that version as the rollback target. Promote the exact candidate only after launch authorization, then verify production assets and a saved-game smoke test. If rollback is needed, restore that recorded production version; saves written by the newer schema should be retained for a forward fix rather than overwritten by older code.
