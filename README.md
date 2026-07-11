# Summit & Snow

A browser-based ski resort tycoon simulation set on the fictional **Mount
Alder**. Build lifts and trails, manage snow and staff, set prices, ride out
the weather, and grow a struggling hill into the valley's favourite resort.

Built per [`game_vision.md`](./game_vision.md) — a playable vertical slice
architected for expansion.

## Run it

```sh
npm install
npm run dev        # → http://localhost:5173
```

```sh
npm test           # vitest — simulation engine tests
npm run build      # production build to dist/
npm run preview    # serve the production build
```

Desktop browsers are the primary target. Requires Node 20+.

## How to play

Each morning is a **planning phase**: build, staff, and price while the clock
is stopped. Hit **Open the resort** and guests arrive through the morning —
watch them buy tickets, rent gear, ride lifts, pick trails that match their
ability, get hungry and cold, spend money, and leave a verdict that becomes
your reputation. At 16:30 the day settles into an operating report.

- **Drag** or **WASD**/arrow keys to move around, **scroll** to zoom,
  **click** anything to inspect it.
- **Space** pauses, **1**/**2** set speed, **Esc** cancels build mode.
- Build panel: pick a lift type / trail / facility, then click the matching
  ghost site on the map. Lifts need operators; grooming and snowmaking need
  their own crews (see Staff panel).
- **Draw your own trails**: Build → “Draw a custom trail”, then click
  waypoints down the mountain (endpoints snap to the ringed stations).
  You pay per metre of groundwork plus every tree cleared from the
  corridor. The game grades your line and warns you — but never stops
  you: lines that climb back uphill leave skiers stuck hiking, and runs
  that dead-end mid-mountain strand them until patrol sleds them out.
- Watch the 7-day forecast: powder sells, wind closes exposed lifts, warm
  spells rot the snowpack. Snow guns fire on cold nights only.
- **Scenario** mode has objectives and a bankruptcy condition; **Sandbox**
  starts with deep pockets.

## Architecture

The simulation is plain TypeScript with zero React/Pixi dependencies — it
runs headless in tests. Everything in `GameState` is JSON-serializable data;
saves are a straight round-trip with schema versioning and a migration hook.

```
src/
  content/        # all tuning data: Mount Alder geometry, balance numbers,
                  #   names & review copy (no logic)
  game/           # the simulation engine (pure state-in/state-out)
    types.ts      #   domain models — GameState is plain serializable data
    rng.ts        #   seeded mulberry32 stream + stateless hash noise
    init.ts       #   new-game construction
    weather.ts    #   season generation, forecast noise, overnight snowpack
    guests.ts     #   agent state machine: needs, movement, trail choice
    lifts.ts      #   queues, boarding, wind holds, breakdowns
    economy.ts    #   demand model, daily settlement, reports, reputation
    resort.ts     #   derived resort-level queries (staffing, capacity, reach)
    events.ts     #   narrative events: provider abstraction + local impl
    objectives.ts #   scenario goal tracking
    actions.ts    #   validated player actions (build/hire/price/borrow)
    simulation.ts #   tick pipeline + day lifecycle orchestration
  state/          # zustand store (owns GameState + scheduler) and saves
  rendering/      # Pixi 8 scene: painterly canvas terrain, trails, lifts
                  #   with animated chairs, guest dots, snow particles
  components/     # React HUD: top bar, build rail, inspector, bottom panel,
                  #   events, daily report, tutorial, objectives, menu
```

Key decisions:

- **Determinism.** One seeded RNG stream lives in `GameState.rngState`; the
  forecast uses stateless hash noise so re-renders never consume the stream.
  Same seed → identical season (asserted by tests).
- **Fixed-timestep sim.** One tick = 0.25 sim-minutes; the scheduler runs
  `speed` ticks per real interval. "End day" just runs ticks synchronously.
- **AI events are structured.** `EventProvider` is an interface; the shipped
  `LocalEventProvider` is deterministic. An LLM-backed provider can be added
  behind the same seam, but any provider's output must be expressed as
  validated `GameEffect` objects — freeform model text never touches state.
- **Rendering reads, never owns.** The Pixi scene reads the store every
  frame; static layers rebuild only when a structure key changes. The
  mountain backdrop is painted once per weather mood into a canvas texture.

## Major systems

| System | Notes |
| --- | --- |
| Weather & snow | Season generated up front; forecast accuracy decays with lead time; overnight melt/wind-strip/snowfall, grooming, snowmaking (needs cold + techs + guns) |
| Guests | Individual agents with skill, budget, patience, energy, warmth, hunger; appeal-scored trail choice; memories drive complaints, reviews, reputation |
| Custom trails | Freeform drawing over a real elevation model and a deterministic forest (`src/game/terrainModel.ts`); gradient grading, per-tree clearing costs, uphill/dead-end consequences (`src/game/trails.ts`) |
| Lifts | Hourly capacity boarding, queue bail-outs, wind holds by type tolerance, morning breakdown rolls softened by mechanics & the garage |
| Economy | Price-elastic demand vs a $55 benchmark, weekend/weather/reputation multipliers, parking ceiling, daily settlement with payroll/energy/interest |
| Staff | Eight departments hired in aggregate; understaffing visibly stops lifts, grooming, rentals, lessons, and patrol coverage |
| Events | Deterministic daily event roll with choices; effects: cash, reputation, demand, morale, deferred breakdowns |
| Scenario | Five objectives, bankruptcy at −$10k, 60-day season |

## Deferred features (not bugs)

- Individual staff members with morale/schedules (aggregate departments ship)
- LLM-backed event provider (seam + schema ship; endpoint wiring does not)
- Trail/lift overlays for patrol & snowmaking coverage (difficulty, snow
  depth, and crowding overlays ship)
- Construction time (building is instant, per sandbox-style v1)
- Sound, and mobile-first layout (playable on tablet, tuned for desktop)
