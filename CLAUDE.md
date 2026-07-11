# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Summit & Snow — a browser-based ski resort tycoon sim (React + TypeScript +
PixiJS + Zustand + Tailwind v4, built with Vite). The product spec is
`game_vision.md`; the architecture overview is in `README.md`.

## Commands

```sh
npm run dev                 # dev server
npm test                    # vitest run (sim engine tests in src/game/*.test.ts)
npx vitest run -t "name"    # single test by name
npx tsc --noEmit -p tsconfig.app.json   # typecheck (build runs this too)
npm run build               # tsc + vite production build
```

## Architecture rules (load-bearing)

- **The sim (`src/game/`) must stay React/Pixi-free and headless-runnable.**
  `GameState` is plain JSON-serializable data — no class instances, no
  functions, no `Map`/`Set`. Anything added to it must survive
  `JSON.parse(JSON.stringify(state))` exactly (there is a test for this).
- **Determinism is a contract.** All sim randomness draws from the single
  mulberry32 stream in `GameState.rngState` via `Rng`; write `rng.state`
  back after use. Never call `Math.random()`/`Date.now()` inside the sim.
  Rendering/UI-only randomness must use `hashNoise` (stateless) so it never
  consumes the sim stream. Same-seed determinism is asserted by tests.
- **Tunable numbers live in `src/content/balance.ts`**, mountain geometry in
  `src/content/mountain.ts`, flavour copy in `src/content/names.ts` — not
  inline in systems.
- **Player mutations go through `src/game/actions.ts`** (validate, then
  mutate, return error string or null) and are dispatched via the store's
  `mutate()` wrapper, which republishes `{ ...game }` so subscribers wake.
- **Event effects are validated.** Anything a narrative event does to the
  game must be a `GameEffect` handled in `events.ts` `applyEffects`; never
  let event text or a future LLM provider mutate state directly.
- **Save compatibility:** bump `SAVE_VERSION` in `src/game/init.ts` and add a
  migration in `src/state/save.ts` whenever `GameState`'s shape changes.
- **Rendering reads, never owns.** The Pixi scene (`src/rendering/scene.ts`)
  polls the store per frame; static layers (trails/lifts/buildings) rebuild
  only when `structureKeyOf()` changes — if you add state that should
  trigger a redraw, add it to that key.

## Gotchas

- **Keep the Pixi renderer at `resolution: 1`** (`src/rendering/MountainCanvas.tsx`).
  Some Chrome builds (seen on 148) apply the GL viewport at logical size while
  the buffer is DPR-scaled, painting the scene into one quadrant at half size
  even though every DOM measurement looks correct. If rendering looks wrong on
  someone's machine, read `diag.log` — the app POSTs its layout chain to the
  dev server's `/__diag` endpoint on boot (dev builds only).

- World coordinates are a 1920×1200 trail-map view; 1 world unit ≈ 2 m
  horizontal (movement code divides m/min by 2).
- A day runs 08:30–16:30 in 0.25-minute ticks; `fastForwardDay` runs the
  same `tick()` loop synchronously, so day-skip and live play stay identical.
- Guests are deleted from `state.guests` on departure and summarized into
  `departedToday`; don't hold guest references across ticks.
- Vite HMR of sim modules resets the Zustand store (back to menu). The
  autosave written at each day-end is the recovery path.
