/**
 * Probe: score every open trail for a fresh guest at the base, per skill,
 * replicating chooseTrail's scoring — to explain why some zones go unridden.
 * Run: npx vite-node scripts/probe-choice.ts
 */
import * as actions from '../src/game/actions'
import { difficultyFit, estimatedWait, planLifts } from '../src/game/guests'
import { newGame } from '../src/game/init'
import { reachableNodes } from '../src/game/resort'
import { getTrailDef } from '../src/game/trails'
import { SURFACE_ENJOYMENT } from '../src/game/weather'
import { openResort } from '../src/game/simulation'
import type { GameState, SkillLevel, Vec2 } from '../src/game/types'
import { skylineYAt } from '../src/game/terrainModel'
import { planCustomTrail } from '../src/game/trails'
import type { Difficulty } from '../src/game/types'

// -- rebuild the same layout (duplicated from stevens-pass.ts, condensed) --
const state: GameState = newGame('sandbox', 42)
state.cash = 10_000_000

const RATIO_BAND: Record<Difficulty, [number, number]> = {
  green: [2.3, 6],
  blue: [1.15, 1.9],
  black: [0.3, 0.95],
  'double-black': [0, 0.14],
}
function makeRun(top: Vec2, bottom: Vec2, diff: Difficulty): Vec2[] {
  const [rMin, rMax] = RATIO_BAND[diff]
  const DX = bottom.x - top.x
  const DY = bottom.y - top.y
  for (let n = 4; n <= 12; n++) {
    const dy = DY / n
    for (let p = 1; p < n; p++) {
      const q = n - p
      for (let rp = rMin; rp <= rMax + 1e-9; rp += 0.05) {
        const rq = (p * rp * dy - DX) / (q * dy)
        if (rq < rMin || rq > rMax) continue
        const signs: number[] = []
        let acc = 0
        for (let i = 0; i < n; i++) {
          acc += p / n
          if (acc >= 0.5 + signs.filter((s) => s > 0).length) signs.push(1)
          else signs.push(-1)
        }
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
        pts[pts.length - 1] = { ...bottom }
        return pts
      }
    }
  }
  throw new Error('no line fits')
}
function lift(name: string, a: Vec2, b: Vec2, kind: 'surface' | 'chair' | 'high-speed-chair' | 'gondola') {
  const before = new Set(Object.keys(state.customLiftSites))
  const err = actions.buildCustomLift(state, a, b, kind)
  if (err) throw new Error(`${name}: ${err}`)
  const id = Object.keys(state.customLiftSites).find((k) => !before.has(k))!
  state.customLiftSites[id].name = name
  return state.customLiftSites[id]
}
function trail(name: string, diff: Difficulty, pts: Vec2[]) {
  void planCustomTrail(state, pts)
  const before = new Set(Object.keys(state.customTrailDefs))
  const err = actions.buildCustomTrail(state, pts)
  if (err) throw new Error(`${name}: ${err}`)
  const id = Object.keys(state.customTrailDefs).find((k) => !before.has(k))!
  state.customTrailDefs[id].name = name
  void diff
}

const bigChief = lift('Big Chief', { x: 700, y: 1030 }, { x: 500, y: 640 }, 'chair')
const dblDiamond = lift('Double Diamond', { x: 500, y: 640 }, { x: 420, y: 470 }, 'chair')
const hogsback = lift('Hogsback', { x: 950, y: 1040 }, { x: 880, y: 460 }, 'high-speed-chair')
const tyeMill = lift('Tye Mill', { x: 1030, y: 1035 }, { x: 1090, y: 400 }, 'chair')
const brooks = lift('Brooks', { x: 1150, y: 1032 }, { x: 1240, y: 780 }, 'chair')
const barrier = lift('Barrier', { x: 1220, y: 1030 }, { x: 1380, y: 500 }, 'high-speed-chair')
const seventh = lift('Seventh Heaven', { x: 1380, y: 500 }, { x: 1270, y: 300 }, 'chair')
const node = (id: string) => state.customNodes[id].pos
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
trail('Big Chief Bowl', 'black', [pos.ddTop, { x: 455, y: 555 }, pos.bcTop])
trail('Showcase', 'black', makeRun(pos.ddTop, pos.bcBottom, 'black'))
trail('Lower Diamond', 'blue', makeRun(pos.bcTop, pos.bcBottom, 'blue'))
trail('Skid Road', 'green', makeRun(pos.bcTop, pos.meadowBase, 'green'))
trail('Hogsback', 'black', makeRun(pos.hogsTop, pos.base, 'black'))
trail('Crest Trail', 'green', makeRun(pos.hogsTop, pos.meadowTop, 'green'))
trail('Roller Coaster', 'blue', makeRun(pos.tyeTop, pos.base, 'blue'))
trail('International', 'black', makeRun(pos.tyeTop, pos.tyeBottom, 'black'))
trail('Seventh Heaven', 'double-black', [pos.seventhTop, { x: 1288, y: 430 }, pos.barrierTop])
trail('Rock Garden', 'black', [pos.seventhTop, { x: 1325, y: 395 }, pos.barrierTop])
trail('Barrier Ridge', 'blue', makeRun(pos.barrierTop, pos.barrierBottom, 'blue'))
trail('Broadway', 'green', makeRun(pos.barrierTop, pos.brooksTop, 'green'))
trail('Brooks Face', 'blue', makeRun(pos.brooksTop, pos.brooksBottom, 'blue'))
actions.setLiftOpen(state, 'meadow-carpet', true)
actions.setStaffCount(state, 'lift-ops', 18)
actions.setStaffCount(state, 'patrol', 10)
openResort(state)

// ------------------------------------------------------------- the probe

const reach = reachableNodes(state)
console.log('reachable nodes:', [...reach].join(' '))

for (const skill of ['first-timer', 'beginner', 'intermediate', 'advanced', 'expert'] as SkillLevel[]) {
  console.log(`\n=== ${skill} at base (riskTolerance 0.5, patience 60, fresh day) ===`)
  const rows: { name: string; diff: string; score: number; note: string }[] = []
  for (const t of Object.values(state.trails)) {
    if (!t.built || !t.open) continue
    const def = getTrailDef(state, t.trailId)
    const name = state.customTrailDefs[t.trailId]?.name ?? def.name
    if (!reach.has(def.topNodeId)) {
      rows.push({ name, diff: def.difficulty, score: -1, note: 'top NOT reachable' })
      continue
    }
    const plan = planLifts(state, 'base', def.topNodeId)
    if (plan === null) {
      rows.push({ name, diff: def.difficulty, score: -1, note: 'no lift route' })
      continue
    }
    const fit = difficultyFit(skill, def.difficulty, 0.5)
    if (fit <= 0.02) {
      rows.push({ name, diff: def.difficulty, score: 0, note: `fit=${fit} (skipped)` })
      continue
    }
    let score = fit * SURFACE_ENJOYMENT[state.trails[t.trailId].surface]
    const queueMin = plan.reduce((s, id) => s + estimatedWait(state, id), 0)
    score *= Math.max(0.15, 1 - queueMin / (6 * (1 + 60 / 40)))
    score *= 1 + def.scenicAppeal * 0.15
    score *= 1 - plan.length * 0.06
    rows.push({ name, diff: def.difficulty, score, note: `lifts=${plan.length} fit=${fit.toFixed(2)} scenic=${def.scenicAppeal}` })
  }
  rows.sort((a, b) => b.score - a.score)
  for (const r of rows) console.log(`  ${r.score.toFixed(3).padStart(7)}  ${r.name.padEnd(16)} ${r.diff.padEnd(12)} ${r.note}`)
}
