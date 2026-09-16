# Guests & Village / Make It Yours previews

These are playable previews for feedback, based on production 0.1.0. Production traffic is not promoted.

| Preview | Git branch | Play |
| --- | --- | --- |
| 0.2.0-preview.1 — Guests & Village | `preview/0.2-guests-village` | https://guests-village-summit-snow.kennyatx1.workers.dev/ |
| 0.3.0-preview.1 — Make It Yours | `preview/0.3-make-it-yours` | https://make-it-yours-summit-snow.kennyatx1.workers.dev/ |

0.3 builds on 0.2. Each hostname has its own browser saves. The release history identifies the preview on the landing page.

## Playthrough suggestions

### 0.2

1. Start a season. Open **Resort journal → Morning briefing** and follow a staffing or building recommendation.
2. Build and staff rentals and a ski school; open the resort. In **Guest stories**, choose a visitor and follow their real activity timeline.
3. Goals depend on skill and party type: learning, challenging runs, relaxed meals/laps, or exploring the mountain. They affect trail preferences; completing one adds five satisfaction points once.
4. Review the latest 24 departed visitors that day. This archive resets the next morning.
5. Fund housing, an inn, or a shuttle. After construction finishes, village origins and visible commutes use those completed projects. Blue guest coats and gold staff coats distinguish their journeys; the shuttle and journeys follow simulation time.

### 0.3

1. Open **Resort journal → Customize**. Rename the resort, a built lift, and a built trail. Try colors, lanterns, and bunting, then inspect the map/town. Save and reload.
2. In **Events**, book one event during morning planning. Booking is charged immediately and included in the day-end report without a second charge.
   - First Tracks Day: staffed ski school; $1,000; six lessons and 65% satisfaction.
   - Local Race Day: open blue-or-harder run; $1,500; 30 blue-or-harder laps and zero incidents.
   - Winter Festival: completed Main Street renewal; $2,500; 100 visitors and 70% satisfaction.
3. Successful events add 0.1 reputation once. Read the result in the daily report and journal event memories. Event demand remains subject to the arrival-capacity ceiling.
4. **Postcards → Download postcard PNG** exports your current village, name, and achievements. Day 60 preserves a frozen season postcard before sandbox rollover. The latest 12 season postcards are retained.

## Verification and scope

- 0.2: 141 tests across 16 files; production build and lint pass (two existing Fast Refresh warnings).
- 0.3: 147 tests across 17 files; includes event booking/reward idempotence, fee accounting, naming isolation, postcard freezing, and production-save migration. Production build passes; lint retains the same two warnings. Existing bundle-size warning remains.
- Browser: desktop briefing, live/departed guest stories, event requirement controls, naming/colors/decorations, postcard rendering and PNG download. Phone 390×844 customization/postcard layout and custom name save/reload. Exported 1200×820 PNG visually inspected. No errors in the final local browser console check.
- The 0.3 guest story includes recent positive/negative guest memories alongside the timeline.
- This is an initial playable implementation. Groups do not yet move as a physically linked party, and town journeys are a town-scale representation of the simulation rather than one continuous camera/world between town and mountain. Event goals use actual lessons, trail laps, and daily satisfaction; race-specific course AI and festival crowd staging are future extensions.
- Event balance needs longer player feedback. Safari/Firefox, physical touch devices, and frame-rate benchmarks were not tested in this pass.

## Published versions

- 0.2 source: `0c4cd61`; Cloudflare version `ecbf960e-341d-45d9-ad02-e640d4a34b70`.
- 0.3 source: `1e2396d`; Cloudflare version `5b72a12a-ed0f-4837-bae9-e6b79d7f20df`.
- Both remote preview landing pages verified. The 0.3 hosted-events menu was opened on the published alias; no console errors observed.
- Production deployment verified unchanged at 100% version `4cbaa59c-e43b-49ec-afc4-e77b585351c8` (0.1.0).
