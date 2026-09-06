# Summit & Snow usage analytics

Added to production 0.1.0 without promoting the 0.2/0.3 gameplay previews.

## Where to see results

Cloudflare account **kennyATX → Storage & databases → D1 → summit-snow-analytics → Console**.
The database is private; the game's public endpoint only accepts events and never returns analytics data.

Run these saved views in the console:

```sql
SELECT * FROM traffic_sources_30d ORDER BY visits DESC;
SELECT * FROM daily_usage ORDER BY date DESC LIMIT 30;
SELECT * FROM returning_players_30d;
```

The connected Cloudflare API can query the same views. `npm run analytics:report`
is available with a Wrangler credential that has D1 read permission; the current
local Wrangler credential cannot query D1, so use the dashboard or connector.
Database ID: `717e88dc-c74a-4ab1-a0ec-fde88bf060b8`.

Cloudflare Web Analytics separately reports page traffic/performance under the
existing kennyatx.com site. Filter the hostname to ski.kennyatx.com.
The app explicitly loads the existing beacon when tracking is enabled instead of
relying on automatic injection into Worker assets.

## Share these links

- X: https://ski.kennyatx.com/?utm_source=x&utm_medium=social&utm_campaign=launch
- LinkedIn: https://ski.kennyatx.com/?utm_source=linkedin&utm_medium=social&utm_campaign=launch
- Community: replace `community-name` in https://ski.kennyatx.com/?utm_source=community-name&utm_medium=community&utm_campaign=launch
- Creator: replace `creator-name` in https://ski.kennyatx.com/?utm_source=creator-name&utm_medium=creator&utm_campaign=launch

Add `&utm_content=clip-1` to compare clips/posts. Only simple lowercase tags
(letters, digits, dots, underscores, hyphens; up to 64 characters) are kept.
Do not put personal information in campaign tags. Without tags, referrer hostname
is used where available; missing/referrer-stripped traffic is called `direct`.
Attribution is per page-load visit, not lifetime first-touch attribution.

## Definitions and limitations

- A **visit** is one page load. Reloading counts another visit.
- `new_game` is a new scenario/sandbox game. `continue_game` is a successful save load.
- `resort_opened` records the planning → operating transition.
- `day_completed` records a completed operating day, including End day fast-forward.
  Use `day=1` for first-day completions. Loading a completed-day save doesn't count again.
- Active seconds accrue only in the game, while visible/focused and with input in
  the past 60 seconds. Planning and report-reading count; paused time can count
  when actively interacting. Heartbeats send around every 30 active seconds,
  with a final partial flush on leaving/hiding. They are wall-clock time, never simulation time.
- Players are random browser IDs, not identified people. IDs expire after 90 days.
  Clearing storage, switching browser/device, or private mode can create new IDs.
- **Returning players (30 days)** played on at least two different UTC dates within
  the last 30 days; same-day reloads alone do not qualify. This is not a D1/D7 retention cohort report.
- Play conversion counts visits with a new or continued game divided by page-load
  visits. Opened-resort and completed-day columns are independent visit milestones,
  not a strict ordered funnel (a loaded save can skip earlier steps).
- Collection is best effort: ad blockers, offline use, disabled browser storage,
  DNT/GPC and opt-out cause undercounting. No historical gameplay can be reconstructed.
- `analytics_test=1`, `utm_source=qa`, and all preview-host events are marked test
  and excluded from report views. Default preview/local browsing sends no events.

## Data and operations

Events contain random player/visit/event IDs, event name, campaign tags, built-in
mountain ID, mode, game day, active seconds, game version and server receipt time.
No save data, custom names, full referral URLs or IPs are stored in D1. The endpoint
uses IP only for an ephemeral rate-limit key (120 requests/minute per edge location),
validates Origin, event type, IDs and a 4 KiB payload cap, and ignores duplicate event IDs.
The endpoint remains public ingestion, so deliberate spoofing is possible.

The menu's Privacy & usage measurement control disables collection and removes
this browser's analytics ID. Do Not Track / Global Privacy Control are respected.
The scheduled Worker deletes events older than 90 days daily at 05:17 UTC.
Existing Cloudflare Web Analytics has its own retention and privacy policy.

## Verification and release

- 139 tests passed; production build and Worker TypeScript check passed.
- Two existing Fast Refresh lint warnings and existing main-bundle-size warning remain.
- Local real-browser start/open/complete/reload/continue/active-time events reached D1.
- Opt-out survived reload; database count remained unchanged.
- Endpoint checks rejected wrong Origin, malformed/oversized JSON, and unknown events.
- SQLite report fixtures verified test exclusion and same-day versus later-day returns.
- Hosted preview beacon event reached remote D1, marked test.
- Production analytics version: `8d22917d-3d5c-4918-99a3-79e525c3d68f`.
- Previous production / rollback: `4cbaa59c-e43b-49ec-afc4-e77b585351c8`.

Rollback: deploy the previous version at 100%. Keep the analytics database for
forward fixes; no game-save schema changes were made. Runtime types are generated
with `wrangler types`. Migration 0001 was applied via the Cloudflare connector and
recorded in `d1_migrations`, since the local CLI lacks D1 permission.

Live verification: production page loaded; explicit Cloudflare beacon returned
HTTP 200 and its RUM request returned HTTP 200. The gameplay collector returned
HTTP 204 and matching `live-verification` test records were read back from D1.
The browser error log was empty. The daily cleanup trigger was deployed.

Source is committed locally on `feat/game-analytics`. GitHub push was rejected by
automatic approval review as separate repository publication; no push occurred.
