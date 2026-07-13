/**
 * PM probe: the first week as a new player, headless, across likely starts.
 * "naive" = open the gates and touch nothing. "guided" = a sensible first
 * build (chair up the hill, a blue back down, rental shop, staffing).
 * Run: npx vite-node scripts/first-week.ts
 */
import * as actions from '../src/game/actions'
import { newGame } from '../src/game/init'
import { fastForwardDay, openResort, startNextDay } from '../src/game/simulation'
import type { GameMode } from '../src/game/types'

function play(label: string, mode: GameMode, mountainId: string, guided: boolean) {
  const state = newGame(mode, 11, mountainId)
  console.log(`\n=== ${label} — start cash $${state.cash.toLocaleString()} ===`)

  if (guided) {
    const err1 = actions.buildCustomLift(state, { x: 950, y: 1040 }, { x: 860, y: 700 }, 'chair')
    const err2 = actions.buildCustomTrail(state, [
      { x: 860, y: 700 },
      { x: 960, y: 700 },
      { x: 870, y: 800 },
      { x: 990, y: 930 },
      { x: 950, y: 1040 },
    ])
    const err3 = actions.buildFacility(state, 'v3', 'rental-shop')
    actions.setStaffCount(state, 'lift-ops', 3)
    actions.setStaffCount(state, 'rental', 2)
    actions.setStaffCount(state, 'patrol', 2)
    for (const [tag, err] of [['lift', err1], ['trail', err2], ['rental', err3]] as const) {
      if (err) console.log(`  build ${tag} FAILED: ${err}`)
    }
    if (state.lifts['meadow-carpet']) actions.setLiftOpen(state, 'meadow-carpet', true)
    if (state.lifts['starter-carpet']) actions.setLiftOpen(state, 'starter-carpet', true)
    console.log(`  after building: $${Math.round(state.cash).toLocaleString()}`)
  } else {
    if (state.lifts['meadow-carpet']) actions.setLiftOpen(state, 'meadow-carpet', true)
    if (state.lifts['starter-carpet']) actions.setLiftOpen(state, 'starter-carpet', true)
  }

  for (let d = 1; d <= 5; d++) {
    openResort(state)
    fastForwardDay(state)
    const r = state.reports[state.reports.length - 1]
    const gripes: Record<string, number> = {}
    for (const g of state.departedToday) {
      for (const k of new Set(g.memories.filter((m) => m.delta < 0).map((m) => m.kind))) {
        gripes[k] = (gripes[k] ?? 0) + 1
      }
    }
    const topGripes = Object.entries(gripes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, n]) => `${k}:${n}`)
      .join(' ')
    console.log(
      `  day ${String(r.day).padStart(2)}: guests=${String(r.guestsServed).padStart(3)} sat=${r.avgSatisfaction} profit=${r.netProfit >= 0 ? '+' : ''}$${r.netProfit.toLocaleString()} cash=$${Math.round(state.cash).toLocaleString()}  ${topGripes}`,
    )
    if (d < 5) startNextDay(state)
  }
  return state
}

play('SCENARIO Alder, naive', 'scenario', 'alder', false)
play('SCENARIO Alder, guided', 'scenario', 'alder', true)
play('SANDBOX Prairie, naive', 'sandbox', 'prairie', false)
play('SANDBOX Prairie, guided', 'sandbox', 'prairie', true)
play('SANDBOX Alder, guided', 'sandbox', 'alder', true)
play('SANDBOX Granite, guided', 'sandbox', 'granite', true)
