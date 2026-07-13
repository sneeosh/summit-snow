/**
 * Proof-of-pacing playthrough: a reasonable (not optimal) player starts on
 * Prairie Knob, builds it out, reacts to the morning alerts, and saves up to
 * buy a second mountain. Logs the whole arc.
 * Run: npx vite-node scripts/playthrough.ts
 */
import * as actions from '../src/game/actions'
import { buyResort, switchResort } from '../src/game/company'
import { MOUNTAIN_MAP } from '../src/content/mountains'
import { newGame } from '../src/game/init'
import { liftStaffRequired } from '../src/game/resort'
import { fastForwardDay, openResort, startNextDay } from '../src/game/simulation'
import { planCustomTrail } from '../src/game/trails'
import type { GameState, Vec2 } from '../src/game/types'

let state: GameState = newGame('sandbox', 2024, 'prairie')
console.log(`Start: Prairie Knob — cash $${state.cash.toLocaleString()}`)

// ---------------------------------------------------------------- helpers

function lift(a: Vec2, b: Vec2, kind: 'chair' | 'high-speed-chair' = 'chair'): boolean {
  const err = actions.buildCustomLift(state, a, b, kind)
  if (err) console.log(`    lift failed: ${err}`)
  return !err
}

function trail(points: Vec2[]): boolean {
  if (planCustomTrail(state, points).conflicts.blockers.length > 0) return false
  const err = actions.buildCustomTrail(state, points)
  if (err) console.log(`    trail failed: ${err}`)
  return !err
}

function syncStaff(): void {
  const openTrails = Object.values(state.trails).filter((t) => t.built).length
  const snowTrails = Object.values(state.trails).filter((t) => t.hasSnowmaking).length
  actions.setStaffCount(state, 'lift-ops', liftStaffRequired(state))
  actions.setStaffCount(state, 'patrol', Math.min(12, Math.ceil(openTrails / 2)))
  actions.setStaffCount(state, 'grooming', Math.min(10, Math.ceil(openTrails / 2)))
  actions.setStaffCount(state, 'snowmaking', Math.ceil(snowTrails / 2))
  actions.setStaffCount(state, 'rental', 4)
  actions.setStaffCount(state, 'food-service', 4)
  if (Object.values(state.facilities).includes('ski-school')) actions.setStaffCount(state, 'instructors', 2)
}

/** the build ladder a sensible player climbs as cash allows (planning phase) */
const builds: { need: number; label: string; run: () => void; done?: boolean }[] = [
  {
    need: 75_000,
    label: 'East chair + two runs + rental shop',
    run: () => {
      lift({ x: 950, y: 1040 }, { x: 780, y: 680 })
      trail([{ x: 780, y: 680 }, { x: 660, y: 790 }, { x: 780, y: 900 }, { x: 950, y: 1040 }])
      trail([{ x: 780, y: 680 }, { x: 900, y: 800 }, { x: 850, y: 930 }, { x: 950, y: 1040 }])
      actions.buildFacility(state, 'v3', 'rental-shop')
    },
  },
  {
    need: 30_000,
    label: 'Snow guns on the greens',
    run: () => {
      actions.installSnowmaking(state, 'bunny')
      actions.installSnowmaking(state, 'meadow-loop')
    },
  },
  {
    need: 40_000,
    label: 'Second parking lot + restroom',
    run: () => {
      actions.buildFacility(state, 'p2', 'parking')
      actions.buildFacility(state, 'v8', 'restroom')
    },
  },
  {
    need: 90_000,
    label: 'West chair + two runs',
    run: () => {
      lift({ x: 700, y: 1030 }, { x: 1080, y: 720 })
      trail([{ x: 1080, y: 720 }, { x: 1180, y: 830 }, { x: 1100, y: 930 }, { x: 950, y: 1040 }])
      trail([{ x: 1080, y: 720 }, { x: 990, y: 830 }, { x: 1060, y: 950 }, { x: 950, y: 1040 }])
    },
  },
  {
    need: 60_000,
    label: 'Ski school + café + guns on the new runs',
    run: () => {
      actions.buildFacility(state, 'v4', 'ski-school')
      actions.buildFacility(state, 'v5', 'cafe')
      for (const t of Object.values(state.trails)) {
        if (t.built && !t.hasSnowmaking && state.cash > 30_000) actions.installSnowmaking(state, t.trailId)
      }
    },
  },
  {
    need: 80_000,
    label: 'Pump station + maintenance garage',
    run: () => {
      actions.buildFacility(state, 'v6', 'pump-station')
      actions.buildFacility(state, 'v7', 'maintenance-garage')
    },
  },
  {
    need: 60_000,
    label: 'Lots three and four — let the weekend in',
    run: () => {
      actions.buildFacility(state, 'p3', 'parking')
      actions.buildFacility(state, 'p4', 'parking')
    },
  },
  {
    need: 170_000,
    label: 'High-speed chair to the summit ridge',
    run: () => {
      lift({ x: 950, y: 1040 }, { x: 640, y: 660 }, 'high-speed-chair')
      trail([{ x: 640, y: 660 }, { x: 560, y: 800 }, { x: 660, y: 930 }, { x: 700, y: 1030 }])
    },
  },
]

// oops — the "west" chair drew east; a player would just shrug and keep both names honest
builds[3].label = 'Second chair + two runs'

const TARGET = 'yuki'
const RESERVE = 60_000
let boughtDay: number | null = null
let granite: number | null = null
let kea: number | null = null

// ---------------------------------------------------------------- the run

for (let d = 1; d <= 130; d++) {
  // morning: build what we can afford, then staff it
  for (const b of builds) {
    if (!b.done && state.cash >= b.need) {
      console.log(`  day ${state.day}: BUILD ${b.label}`)
      b.run()
      b.done = true
      break // one project a morning — humans don't queue six
    }
  }
  syncStaff()

  openResort(state)
  fastForwardDay(state)
  const r = state.reports[state.reports.length - 1]

  if (granite === null && state.cash >= MOUNTAIN_MAP.granite.price) granite = state.day
  if (kea === null && state.cash >= MOUNTAIN_MAP.kea.price) kea = state.day

  if (d % 3 === 0 || d <= 4) {
    console.log(
      `S${state.season} day ${String(state.day).padStart(2)}: guests=${String(r.guestsServed).padStart(3)} sat=${r.avgSatisfaction} rep=${state.reputation.toFixed(1)} profit=+$${r.netProfit.toLocaleString()} cash=$${Math.round(state.cash).toLocaleString()}`,
    )
  }

  if (boughtDay === null && state.cash >= MOUNTAIN_MAP[TARGET].price + RESERVE) {
    const err = buyResort(state, TARGET)
    if (!err) {
      boughtDay = state.day
      console.log(`\n★ day ${state.day}: BOUGHT ${MOUNTAIN_MAP[TARGET].name} — cash left $${Math.round(state.cash).toLocaleString()}`)
      break
    }
  }
  if (state.gameOver) {
    console.log(`\nSEASON OVER at day ${state.day} — cash $${Math.round(state.cash).toLocaleString()}, no second mountain`)
    break
  }
  startNextDay(state)
}

console.log(`\ncould have afforded: Granite Notch day ${granite ?? '—'}, Kea Basin day ${kea ?? '—'}, ${MOUNTAIN_MAP[TARGET].name} day ${boughtDay ?? '—'}`)

// move to the new mountain, build it out, and climb the rest of the ladder:
// prairie earns caretaker money behind us; target Wasatch Crown ($2.8M)
if (boughtDay !== null) {
  const next = switchResort(state, TARGET)
  if (typeof next === 'string') throw new Error(`switch failed: ${next}`)
  state = next

  const yukiBuilds: { need: number; label: string; run: () => void; done?: boolean }[] = [
    {
      need: 25_000,
      label: 'yuki: rental shop',
      run: () => void actions.buildFacility(state, 'v3', 'rental-shop'),
    },
    {
      need: 75_000,
      label: 'yuki: powder chair + two runs',
      run: () => {
        lift({ x: 950, y: 1040 }, { x: 860, y: 500 })
        trail([{ x: 860, y: 500 }, { x: 760, y: 660 }, { x: 880, y: 820 }, { x: 950, y: 1040 }])
        trail([{ x: 860, y: 500 }, { x: 980, y: 680 }, { x: 900, y: 900 }, { x: 950, y: 1040 }])
      },
    },
    {
      need: 45_000,
      label: 'yuki: lots 2–4 + restroom + café',
      run: () => {
        actions.buildFacility(state, 'p2', 'parking')
        actions.buildFacility(state, 'p3', 'parking')
        actions.buildFacility(state, 'p4', 'parking')
        actions.buildFacility(state, 'v8', 'restroom')
        actions.buildFacility(state, 'v5', 'cafe')
      },
    },
    {
      need: 110_000,
      label: 'yuki: second chair + two runs + school',
      run: () => {
        lift({ x: 1150, y: 1030 }, { x: 1120, y: 520 })
        trail([{ x: 1120, y: 520 }, { x: 1220, y: 700 }, { x: 1140, y: 880 }, { x: 1150, y: 1030 }])
        trail([{ x: 1120, y: 520 }, { x: 1040, y: 700 }, { x: 1090, y: 900 }, { x: 950, y: 1040 }])
        actions.buildFacility(state, 'v4', 'ski-school')
      },
    },
  ]

  let caretakerSeen = false
  for (let d = 1; d <= 160; d++) {
    for (const b of yukiBuilds) {
      if (!b.done && state.cash >= b.need) {
        console.log(`  S${state.season} day ${state.day}: BUILD ${b.label}`)
        b.run()
        b.done = true
        break
      }
    }
    syncStaff()
    openResort(state)
    fastForwardDay(state)
    const r = state.reports[state.reports.length - 1]
    const wire = r.highlights.find((h) => h.includes('Caretakers'))
    if (wire && !caretakerSeen) {
      caretakerSeen = true
      console.log(`  S${state.season} day ${state.day}: ${wire}`)
    }
    if (d % 6 === 0) {
      console.log(
        `S${state.season} day ${String(state.day).padStart(2)} @yuki: guests=${String(r.guestsServed).padStart(3)} sat=${r.avgSatisfaction} profit=+$${r.netProfit.toLocaleString()}${wire ? ' (+wire)' : ''} cash=$${Math.round(state.cash).toLocaleString()}`,
      )
    }
    if (state.cash >= MOUNTAIN_MAP.wasatch.price + RESERVE) {
      const err = buyResort(state, 'wasatch')
      if (!err) {
        console.log(`\n★★ S${state.season} day ${state.day}: BOUGHT Wasatch Crown — cash left $${Math.round(state.cash).toLocaleString()}`)
      } else {
        console.log(`wasatch buy failed: ${err}`)
      }
      break
    }
    startNextDay(state)
  }
}
