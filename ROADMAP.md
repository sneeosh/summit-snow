# Summit & Snow — Product Roadmap

*Last updated: July 12, 2026 · Owner: Kenny · Status: live at [ski.kennyatx.com](https://ski.kennyatx.com)*

---

## North star

**The mountain should feel alive, and running it should feel like a story you tell your friends.**

Every release earns its place by strengthening one of three pillars:

1. **A living mountain** — weather, snow, skiers, and machinery you can watch for its own sake.
2. **Decisions with teeth** — pricing, terrain, and staffing choices whose consequences you can see on the hill, not just in a ledger.
3. **Stories worth retelling** — emergent moments ("a nor'easter buried the base lodge the day the school group arrived") that no two players share.

**North-star metric:** a first-time player reaches the end of their first season unassisted, and starts a second one. Supporting signals: session length, day-1 tutorial completion, share/screenshot rate once photo mode exists.

---

## Where we are (v0.9 — "The Friends Playtest" build)

The vertical slice outgrew itself. Shipped and deployed:

- Full daily-operations sim: weather, snowmaking, grooming, guests with skill levels, lifts, freeform trail drawing with junctions, facilities, staffing, finances, events.
- **8 mountains** across real climate regions, a **company layer** (buy / sell / switch resorts, caretaker income), and multi-season sandbox play.
- Deterministic engine with 67 tests, save migrations through v6, mobile support, Cloudflare deployment.

Known debt going in: per-segment trail grading is unfair (one steep pitch grades the whole run), difficulty badge behavior while drawing needs a design decision, and the AI narrative layer still runs only on the local deterministic provider.

---

## Mountain identities — implementation in review (September 2026)

All eight hills now have regional scenery and development guidance. Seven have
new starting layouts; Alder retains the scenario network. Local relief and wind
exposure affect routing and lift holds. Grooming can preserve natural snow,
and guest surface preferences depend on ability. Optional sandbox goals vary
by hill and require connected terrain. Save v8 retains both older geometry revisions.

Terrain art was reviewed through rendered contact sheets. Full-season headless
checks cover all eight hills. A 336-day first-week comparison is recorded in
`docs/balance-playtest.md`. Full-season expansion and snow-recovery probes are
in `docs/expansion-playtest.md` and `docs/snow-recovery-playtest.md`. Merged
return routes now count correctly toward mountain goals. Interactive browser
review, broader weather-seed balance and acquisition pacing remain before release. Follow-ons: richer village activity, night
skiing for Prairie, and avalanche control for advanced alpine terrain.

## Release 1.0 — "Opening Day" *(target: late summer 2026)*

**Theme: the game is finishable, fair, and welcoming. Ship the game we already have, polished.**

This is a hardening release informed by the friends playtest. No new systems.

| Epic | What it delivers |
|---|---|
| **Fair terrain grading — in review** | New regional trails use a 100 m sustained pitch, with separate rollover warnings and pitch readouts. Existing saved grades remain intact. |
| **Playtest punch list** | Every stuck-point, confusion, and "wait, what happened?" from the friends playtest triaged and fixed. |
| **Scenario arc** | The guided scenario gets a real ending: a season-end ceremony, a graded report card, and a hook into sandbox ("your mountain is yours now"). |
| **Performance floor** | 500+ guests at 60 fps on a mid-tier laptop; hard budget enforced by a perf test in CI. |
| **Onboarding v2** | Tutorial completion measured; every step that loses >15% of players gets redesigned. |

**Exit criteria:** 5 of 5 fresh playtesters finish season one without help. Zero soft-locks in fuzz sweeps.

---

## Release 1.1 — "Patrol" *(fall 2026)*

**Theme: the mountain pushes back. Risk, safety, and the drama of keeping terrain open.**

Right now weather is scenery with stats. This release makes the upper mountain something you *earn* every morning.

- **Avalanche & terrain control:** overnight storms load slide paths; steep terrain starts the day closed until patrol does control work. Opening the alpine on a powder day becomes the game's signature tension — every real resort's daily drama, and no tycoon game has it.
- **Incidents on the hill:** collisions, lost kids, injuries on icy days. Patrol response time (staffing × station placement) determines whether an incident is a footnote or a reputation event.
- **Powder-day economics:** 30 cm overnight should visibly spike demand, wreck your parking, overwhelm rentals, and reward the player who staffed up on the forecast. The forecast gamble becomes the core daily decision.
- **Grooming as a plan, not a toggle:** a nightly grooming queue with limited cat-hours. Watch the cats work the hill at dawn.

**Why now:** playtests show mid-game flatlines once cash is comfortable. Risk management is the depth layer that doesn't require new content — it re-uses every mountain we already have.

---

## Release 1.2 — "The Gazette" *(winter 2026–27)*

**Theme: turn the sim's numbers into stories. The AI narrative layer, for real.**

The provider abstraction has been waiting since day one. Time to plug it in.

- **LLM-backed event provider** (opt-in, bring-your-own-key or a hosted tier): guest reviews written from *actual* guest experiences that day — the trail they got stuck on, the 40-minute line they stood in, the hot chocolate that saved the trip.
- **The Alder Gazette:** a weekly in-game local newspaper reporting on your resort — storm coverage, opinion pieces from disgruntled season-pass holders, profiles of your best instructor. Every article grounded in real sim data via the existing validated `GameEffect` pipeline (the architecture rule holds: the model narrates, it never mutates).
- **Guests with memory:** returning visitors who remember last visit. A family that had a great first trip comes back every year — and tells you so.
- **Rival resort chatter:** flavor-level for now (news items about the resort across the valley) — seeds Release 2.0.

**Guardrails:** deterministic provider remains the default and the test target; LLM output is cosmetic-plus-validated-effects only; token cost budgeted per game-day and cached.

---

## Release 2.0 — "Empire" *(spring 2027)*

**Theme: the company layer grows teeth. From resort manager to mountain mogul.**

The multi-resort foundation shipped in v0.9; now make it a strategy game.

- **A rival operator** buying the mountains you don't — losing Wasatch Crown to *Pinnacle Resorts Group* because you dawdled should sting. Compete on reputation and season-pass pricing in shared regional demand pools.
- **Season passes & the multi-resort pass:** the real economics of the industry. Your own Epic/Ikon-style pass across your portfolio changes what "buying a mountain" means.
- **Real caretaker simulation:** frozen resorts run a lightweight aggregate sim instead of a fixed income formula; a neglected resort decays, a well-managed GM (hireable!) grows it.
- **Village & real estate:** the long-promised base-village expansion — lodging, retail leases, and the bed-base flywheel (beds → destination guests → multi-day tickets → higher spend per visit).
- **Company screen worthy of the fantasy:** portfolio map, consolidated P&L, prestige goals ("own a resort on three continents").

---

## Release 2.5 — "Four Seasons" *(summer 2027)*

**Theme: what does a ski resort do in July?**

- **Summer operations:** lift-served mountain biking, alpine slides, weddings at the summit lodge, hiking. Off-season revenue vs. the maintenance window trade-off.
- **The shoulder-season build window:** major construction (new lifts, terrain expansion) happens in summer, planned in spring — turning the calendar itself into a strategic resource.
- **A climate arc:** across a multi-decade sandbox, snowlines creep upward. Low-elevation resorts feel it first. Snowmaking, elevation, and diversification become existential strategy, not just tuning. (Handled with care — it's a systems pressure, not a lecture.)

---

## Continuous tracks (every release)

- **Mountain of the Month:** the 8-mountain roster keeps growing — community-suggested real-mountain recreations in the Stevens Pass tradition, each shipped with a scenario.
- **Photo mode & sharing:** one-click beauty shots with time-of-day and weather control; save files shareable by URL. Word of mouth is the marketing budget.
- **Determinism & test discipline:** every system lands with headless-sim tests; the fuzz sweep and same-seed contract are non-negotiable.
- **Performance:** guest count ceilings rise only when the frame budget allows.

## Moonshots (not scheduled, kept warm)

- **Async multiplayer:** rival players' resorts appear as the competitor operator in your world.
- **Mountain workshop:** in-browser terrain editor and community mountain sharing.
- **First-person inspection mode:** ride your own gondola after a storm.

---

## What we will *not* do

- No spreadsheet creep — every new stat must be visible **on the hill** or it doesn't ship.
- No unvalidated AI state mutation, ever.
- No new system while a shipped one is confusing. Depth beats breadth; the playtest punch list always outranks the shiny thing.
