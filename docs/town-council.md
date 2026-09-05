# Town & council

A resort partnership expressed through an authored village that grows over time.
The player selects investments and negotiates council support; buildings occupy
fixed lots automatically. There is no road drawing, zoning or building placement.

## Playing

Select **Town view** in the bottom navigation. Switch between Panorama, Main
Street, Riverside and Station Square. Mountain view returns to normal resort
controls. Visiting town does not pause an operating day; the top-bar clock and
pause controls remain available.

During morning planning, choose a project. The council preview shows residents,
local businesses and conservation interests. A support score of 55 earns a vote;
two votes approve a proposal. Funding pays the displayed capital cost immediately.
Only one project may be under construction, and there is no cancellation/resale.
Construction advances at the next morning after each operating day. Completed
projects gain a level, appear in the scene and announce their opening.

| Investment | First cost | First duration | Benefit per level | Daily service cost per level |
| --- | ---: | ---: | --- | ---: |
| Employee housing | $35,000 | 3 days | 3.5% payroll relief | $30 |
| Shuttle station | $24,000 | 2 days | 80 additional visitor access capacity | $100 |
| Main Street | $18,000 | 2 days | 5 percentage points of demand multiplier | $40 |
| Village inn | $65,000 | 4 days | 48 visitor beds; +24 base demand | $80 |

Each project has three levels. Cost multiplies by the new level; duration adds
one day per previous level. Inn proposals can include employee homes for $18,000
extra: a staff lodge, 2% additional payroll relief and greater resident support.
Combined payroll relief is capped at 15%. Inn beds represent destination demand;
this slice does not simulate individual overnight stays or separate room sales.
Maintenance and economic benefits begin only when construction finishes. Service
costs appear under **Facilities & town services** in the daily report.

Completed public projects improve council relationships. Inns create resident
and conservation pressure, varying by region; housing, transit and Main Street
can make later proposals acceptable. Promised employee homes are delivered with
the inn and improve the resident relationship on completion. Votes are deterministic
and previewed before money is spent.

## Visible growth

Construction sites develop foundations, scaffolding and roofs. Housing gains
chalets and floors; Main Street gains a market hall, stalls and bunting; inns gain
wings and employee homes; transit gains shelters, buses and a station hall.
More residents and visitors populate the sidewalks as investment accumulates.
The stage label progresses from Mountain hamlet to Growing village (two total
levels), Thriving ski town (six) and Alpine destination (ten).

Town geometry is authored once, with regional colors and mountain backdrops.
Every viewpoint shows the same saved town. Each owned resort has an independent
town; inactive resorts freeze until revisited, matching existing portfolio rules.
Save version 10 migrates existing active and inactive resorts to empty towns,
preserving their terrain and regional operations.

## Validation and limits

Headless tests cover atomic proposal rejection, approved funding, real operating-day
construction, benefits only on completion, all twelve upgrades on all eight hills,
season rollover, independent holdings and save migration/round-trip. The all-upgrade
tests supply capital to isolate progression; they do not certify profitability.
The actual SVG scene has been rendered and visually reviewed at initial and full
growth. Full browser interaction and responsive layout QA remain pending because
the preview environment blocks the game URL. This branch has not been deployed.

## Regional character, ceremonies and memories

All eight towns now have authored regional architecture and a gathering place:
Prairie's brick streets and skating pond; Granite's slate roofs and quarry clock;
Alder's timber buildings and cedar boardwalk; Yuki's broad eaves, lanterns and hot
spring; Kea's low roofs and lakeside lookout; Elk's western storefronts and aspen
circle; Wasatch's masonry and bouldering garden; Blanche's steep chalets and café.

On an opening day the town navigation advertises the new opening. In town,
**Visit the opening** focuses the relevant viewpoint and plays an eight-second
ribbon ceremony. It does not interrupt or pause resort operations.

**Village scrapbook** preserves a visual memory at every district opening and
charter adoption. Pick a memory to view its buildings and policies, then select
Today to compare. Historical views are still and always use morning lighting;
council actions and financial figures continue to refer to the current village.
Snapshots store independent plain data, not screenshots, and do not consume RNG.
New games begin with Our first winter. Version 11 migrations retain existing
construction and upgrades and record The village when we arrived; they do not
invent pictures of milestones that happened before recording was available.

The winter-market charter costs $12,000, requires a completed Main Street and two
council votes, adds two visible stalls and 3 percentage points to the demand
multiplier, and costs $60 per operating day. Dark-sky village costs $8,000, requires
two votes, softens evening lamp glow and reduces all town service costs by 20%.
Both are permanent and immediate. Rejected or repeated proposals never spend cash.

Crowds reflect current resort attendance as well as completed development. A busy
operating resort activates the arriving shuttle; chimney steam animates gently,
and windows warm at 16:00. All ambient animation respects reduced-motion settings
and stops in scrapbook views. Regional tableaux have been rendered and reviewed;
interactive browser and animation playback QA still need the preview blocker resolved.
