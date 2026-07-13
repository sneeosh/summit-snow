/**
 * Playtest: recreate the Stevens Pass lift map (front side) on Mount Alder.
 * Builds the layout via real player actions, simulates several days headless,
 * prints a playability report, and writes a save payload to /tmp so the
 * layout can be loaded in the browser.
 *
 * Run: npx vite-node scripts/stevens-pass.ts
 */
import { writeFileSync } from 'node:fs'
import * as actions from '../src/game/actions'
import { newGame, SAVE_VERSION } from '../src/game/init'
import { fastForwardDay, openResort, startNextDay } from '../src/game/simulation'
import { planCustomTrail } from '../src/game/trails'
import { skylineYAt } from '../src/game/terrainModel'
import type { Difficulty, GameState, LiftKind, Vec2 } from '../src/game/types'

const state: GameState = newGame('sandbox', 42)
const SANDBOX_CASH = state.cash
state.cash = 10_000_000 // budget is not the experiment; layout is

// ---------------------------------------------------------------- helpers

function buildLift(name: string, a: Vec2, b: Vec2, kind: LiftKind) {
  const before = new Set(Object.keys(state.customLiftSites))
  const err = actions.buildCustomLift(state, a, b, kind)
  if (err) throw new Error(`lift ${name}: ${err}`)
  const id = Object.keys(state.customLiftSites).find((k) => !before.has(k))!
  state.customLiftSites[id].name = name
  const site = state.customLiftSites[id]
  console.log(`LIFT  ${name.padEnd(16)} ${kind.padEnd(16)} ${state.lifts[id].lengthM} m`)
  return site
}

function buildTrail(name: string, expected: Difficulty, points: Vec2[] | Vec2[][]) {
  // accept alternate lines (e.g. opposite zigzag phase) and take the first
  // that isn't blocked by overlap/grazing rules — like a player adjusting
  const candidates = Array.isArray(points[0]) ? (points as Vec2[][]) : [points as Vec2[]]
  let pts = candidates[0]
  for (const cand of candidates) {
    if (planCustomTrail(state, cand).conflicts.blockers.length === 0) {
      pts = cand
      break
    }
  }
  const plan = planCustomTrail(state, pts)
  const before = new Set(Object.keys(state.customTrailDefs))
  const err = actions.buildCustomTrail(state, pts)
  if (err) throw new Error(`trail ${name}: ${err}`)
  const id = Object.keys(state.customTrailDefs).find((k) => !before.has(k))!
  const def = state.customTrailDefs[id]
  def.name = name
  const flag = def.difficulty === expected ? '' : `  << wanted ${expected}, got ${def.difficulty} (steepest ${plan.analysis.steepest})`
  console.log(
    `TRAIL ${name.padEnd(16)} ${def.difficulty.padEnd(12)} ${def.lengthM} m  top=${def.topNodeId || 'NONE'} bottom=${def.bottomNodeId || 'NONE'}${flag}`,
  )
  for (const w of plan.warnings) console.log(`        warning: ${w}`)
  return def
}

/**
 * Generate a zigzag run from top to bottom whose every segment's |dx|/|dy|
 * ratio sits inside the band for the target difficulty (grade here is purely
 * segment angle: gradient = 0.632 * dy / hypot(dx, dy)).
 */
const RATIO_BAND: Record<Difficulty, [number, number]> = {
  green: [2.3, 6],
  blue: [1.15, 1.9],
  black: [0.3, 0.95],
  'double-black': [0, 0.14],
}

function makeRun(top: Vec2, bottom: Vec2, diff: Difficulty, flip = false): Vec2[] {
  const [rMin, rMax] = RATIO_BAND[diff]
  const DX = bottom.x - top.x
  const DY = bottom.y - top.y
  if (DY <= 0) throw new Error('run must descend')

  for (let n = 4; n <= 12; n++) {
    const dy = DY / n
    for (let p = 1; p < n; p++) {
      const q = n - p
      // p segments drift +x at ratio rp, q segments -x at ratio rq
      for (let rp = rMin; rp <= rMax + 1e-9; rp += 0.05) {
        const rq = (p * rp * dy - DX) / (q * dy)
        if (rq < rMin || rq > rMax) continue
        // interleave signs as evenly as possible
        const signs: number[] = []
        let acc = 0
        for (let i = 0; i < n; i++) {
          acc += p / n
          if (acc >= 0.5 + signs.filter((s) => s > 0).length) signs.push(1)
          else signs.push(-1)
        }
        if (flip) signs.reverse() // opposite switchback phase, same endpoints
        const pts: Vec2[] = [{ ...top }]
        let x = top.x
        let y = top.y
        let ok = true
        for (const s of signs) {
          x += s > 0 ? rp * dy : -rq * dy
          y += dy
          if (x < 60 || x > 1860 || y < skylineYAt(x) + 10) {
            ok = false
            break
          }
          pts.push({ x: Math.round(x), y: Math.round(y) })
        }
        if (!ok) continue
        // land exactly on the bottom node so the endpoint snaps
        pts[pts.length - 1] = { ...bottom }
        return pts
      }
    }
  }
  throw new Error(`no ${diff} line fits from ${JSON.stringify(top)} to ${JSON.stringify(bottom)}`)
}

// ------------------------------------------------------------------ lifts
// Mapping Stevens Pass front side: Big Chief massif on the left shoulder,
// Hogsback up the middle, Tye Mill / Seventh Heaven on the right ridge,
// Barrier and Brooks lower right. Meadow carpet stands in for Daisy.

console.log('=== building lifts ===')
const bigChief = buildLift('Big Chief', { x: 700, y: 1030 }, { x: 500, y: 640 }, 'chair')
const dblDiamond = buildLift('Double Diamond', { x: 500, y: 640 }, { x: 420, y: 470 }, 'chair')
const hogsback = buildLift('Hogsback', { x: 950, y: 1040 }, { x: 880, y: 460 }, 'high-speed-chair')
const tyeMill = buildLift('Tye Mill', { x: 1030, y: 1035 }, { x: 1090, y: 400 }, 'chair')
const brooks = buildLift('Brooks', { x: 1150, y: 1032 }, { x: 1240, y: 780 }, 'chair')
const barrier = buildLift('Barrier', { x: 1220, y: 1030 }, { x: 1380, y: 500 }, 'high-speed-chair')
const seventh = buildLift('Seventh Heaven', { x: 1380, y: 500 }, { x: 1270, y: 300 }, 'chair')

const node = (id: string) => (state.customNodes[id] ?? { pos: { x: 0, y: 0 } }).pos
const pos = {
  bcTop: node(bigChief.topNodeId),
  bcBottom: node(bigChief.bottomNodeId),
  ddTop: node(dblDiamond.topNodeId),
  hogsTop: node(hogsback.topNodeId),
  tyeTop: node(tyeMill.topNodeId),
  tyeBottom: node(tyeMill.bottomNodeId),
  brooksTop: node(brooks.topNodeId),
  brooksBottom: node(brooks.bottomNodeId),
  barrierTop: node(barrier.topNodeId),
  barrierBottom: node(barrier.bottomNodeId),
  seventhTop: node(seventh.topNodeId),
  base: { x: 950, y: 1040 },
  meadowBase: { x: 560, y: 1010 },
  meadowTop: { x: 470, y: 820 },
}

// ----------------------------------------------------------------- trails

console.log('\n=== cutting trails ===')
// Big Chief zone
buildTrail('Big Chief Bowl', 'black', [pos.ddTop, { x: 455, y: 555 }, pos.bcTop]) // ends at a mid-mountain station
buildTrail('Showcase', 'black', [makeRun(pos.ddTop, pos.bcBottom, 'black'), makeRun(pos.ddTop, pos.bcBottom, 'black', true)])
buildTrail('Lower Diamond', 'blue', [makeRun(pos.bcTop, pos.bcBottom, 'blue'), makeRun(pos.bcTop, pos.bcBottom, 'blue', true)])
buildTrail('Skid Road', 'green', [makeRun(pos.bcTop, pos.meadowBase, 'green'), makeRun(pos.bcTop, pos.meadowBase, 'green', true)])
// Hogsback zone
buildTrail("Hogsback", 'black', [makeRun(pos.hogsTop, pos.base, 'black'), makeRun(pos.hogsTop, pos.base, 'black', true)])
buildTrail('Crest Trail', 'green', [makeRun(pos.hogsTop, pos.meadowTop, 'green'), makeRun(pos.hogsTop, pos.meadowTop, 'green', true)]) // connector to the Meadow knoll
// Tye Mill zone
buildTrail('Roller Coaster', 'blue', [makeRun(pos.tyeTop, pos.base, 'blue'), makeRun(pos.tyeTop, pos.base, 'blue', true)])
buildTrail('International', 'black', [makeRun(pos.tyeTop, pos.tyeBottom, 'black'), makeRun(pos.tyeTop, pos.tyeBottom, 'black', true)])
// Seventh Heaven zone (both end at the Barrier top station)
buildTrail('Seventh Heaven', 'double-black', [pos.seventhTop, { x: 1288, y: 430 }, pos.barrierTop])
buildTrail('Rock Garden', 'black', [pos.seventhTop, { x: 1325, y: 395 }, pos.barrierTop])
// Barrier zone
buildTrail('Barrier Ridge', 'blue', [makeRun(pos.barrierTop, pos.barrierBottom, 'blue'), makeRun(pos.barrierTop, pos.barrierBottom, 'blue', true)])
// green road to Brooks, hand-routed left out of Barrier Ridge's corridor so
// it crosses nothing at a grazing angle
buildTrail('Broadway', 'green', [
  pos.barrierTop,
  { x: 1150, y: 590 },
  { x: 1310, y: 650 },
  { x: 1095, y: 725 },
  pos.brooksTop,
])
// Brooks zone
buildTrail('Brooks Face', 'blue', [makeRun(pos.brooksTop, pos.brooksBottom, 'blue'), makeRun(pos.brooksTop, pos.brooksBottom, 'blue', true)])

// ------------------------------------------------------------- facilities

actions.setLiftOpen(state, 'meadow-carpet', true) // prebuilt "Daisy" starts closed

actions.buildFacility(state, 'v3', 'rental-shop')
actions.buildFacility(state, 'v4', 'ski-school')
actions.buildFacility(state, 'v5', 'cafe')
actions.buildFacility(state, 'v6', 'restaurant')
actions.buildFacility(state, 'v7', 'patrol-hq')
actions.buildFacility(state, 'v8', 'restroom')
actions.buildFacility(state, 'p2', 'parking')
actions.buildFacility(state, 'm1', 'cafe')

actions.setStaffCount(state, 'lift-ops', 18)
actions.setStaffCount(state, 'patrol', 10)
actions.setStaffCount(state, 'grooming', 8)
actions.setStaffCount(state, 'rental', 4)
actions.setStaffCount(state, 'instructors', 3)
actions.setStaffCount(state, 'food-service', 6)
actions.setStaffCount(state, 'maintenance', 2)

const spent = 10_000_000 - state.cash
console.log(`\nTotal build cost: $${spent.toLocaleString()} (sandbox starts with $${SANDBOX_CASH.toLocaleString()})`)

// ------------------------------------------------------------- simulation

console.log('\n=== simulating days ===')
for (let d = 1; d <= 6; d++) {
  openResort(state)
  fastForwardDay(state)

  const report = state.reports[state.reports.length - 1]
  // distinct guests per memory kind
  const memories: Record<string, number> = {}
  for (const g of state.departedToday) {
    for (const kind of new Set(g.memories.map((m) => m.kind))) memories[kind] = (memories[kind] ?? 0) + 1
  }
  const rev = report.revenue
  const revTotal = rev.tickets + rev.rentals + rev.food + rev.lessons + rev.parking

  console.log(`\n--- Day ${state.day} ---`)
  console.log(
    `guests=${report.guestsServed} avgSat=${report.avgSatisfaction} revenue=$${Math.round(revTotal).toLocaleString()} profit=$${report.netProfit.toLocaleString()} incidents=${report.incidents}`,
  )
  console.log('memories (guests):', JSON.stringify(memories))
  const liftRides = Object.values(state.lifts)
    .map((l) => `${(state.customLiftSites[l.siteId]?.name ?? l.siteId)}:${l.totalRidesToday}`)
    .join('  ')
  console.log('lift rides:', liftRides)
  const trailRides = Object.values(state.trails)
    .filter((t) => t.built)
    .map((t) => `${(state.customTrailDefs[t.trailId]?.name ?? t.trailId)}:${t.ridesToday}${t.open ? '' : '(closed)'}`)
    .join('  ')
  console.log('trail rides:', trailRides)

  if (d < 6) startNextDay(state)
}

// --------------------------------------------------------------- save file

const payload = {
  version: SAVE_VERSION,
  savedAt: new Date().toISOString(),
  label: 'Stevens Pass playtest',
  state,
}
writeFileSync('/tmp/stevens-pass-save.json', JSON.stringify(payload))
console.log('\nSave written to /tmp/stevens-pass-save.json (slot key: summit-snow:save:stevens)')
