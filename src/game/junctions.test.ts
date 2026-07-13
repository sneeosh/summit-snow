import { describe, expect, it } from 'vitest'
import { buildCustomLift, buildCustomTrail, setStaffCount } from './actions'
import { newGame } from './init'
import { lineOptionsAt, nearestOnTrail, rebuildJunctions } from './junctions'
import { fastForwardDay, openResort } from './simulation'
import { getTrailDef, planCustomTrail } from './trails'
import type { GameState, Vec2 } from './types'

/** a resort with one lift up the middle and one on the left shoulder */
function withLifts(): GameState {
  const state = newGame('sandbox', 7)
  state.cash = 5_000_000
  expect(buildCustomLift(state, { x: 950, y: 1040 }, { x: 880, y: 460 }, 'chair')).toBeNull()
  expect(buildCustomLift(state, { x: 700, y: 1030 }, { x: 760, y: 520 }, 'chair')).toBeNull()
  setStaffCount(state, 'lift-ops', 10)
  return state
}

const leftTopId = (state: GameState) => Object.values(state.customLiftSites)[1].topNodeId

// runs from the main lift top (880,460) down to the base (950,1040)
const LINE_A: Vec2[] = [
  { x: 880, y: 460 },
  { x: 950, y: 700 },
  { x: 900, y: 900 },
  { x: 950, y: 1040 },
]
// same top, swings right then cuts back left across LINE_A
const LINE_B: Vec2[] = [
  { x: 880, y: 460 },
  { x: 1000, y: 600 },
  { x: 850, y: 800 },
  { x: 560, y: 1010 },
]

function trailIdByPath(state: GameState, path: Vec2[]): string {
  const found = Object.values(state.customTrailDefs).find((d) => d.path[1].x === Math.round(path[1].x))
  expect(found).toBeDefined()
  return found!.id
}

describe('trail crossings', () => {
  it('two crossing runs create a junction with a leg on each', () => {
    const state = withLifts()
    expect(buildCustomTrail(state, LINE_A)).toBeNull()
    expect(buildCustomTrail(state, LINE_B)).toBeNull()

    const a = trailIdByPath(state, LINE_A)
    const b = trailIdByPath(state, LINE_B)
    // A × B mid-slope, plus B crossing the prebuilt Pinecone Way lower down
    const junctions = Object.values(state.junctions)
    expect(junctions.length).toBe(2)
    const j = junctions.find((x) => x.legs.some((l) => l.trailId === a))!
    expect(j).toBeDefined()
    expect(state.customNodes[j.nodeId]).toBeDefined()
    expect(j.legs.length).toBe(2)
    for (const leg of j.legs) {
      expect(leg.t).toBeGreaterThan(0.02)
      expect(leg.t).toBeLessThan(0.98)
    }
    // the junction offers each line as a way onward from the other
    const opts = lineOptionsAt(state, j.nodeId, a)
    expect(opts.length).toBe(1)
    expect(opts[0].trailId).toBe(b)
  })

  it('junctions survive a JSON round trip and rebuild from geometry', () => {
    const state = withLifts()
    buildCustomTrail(state, LINE_A)
    buildCustomTrail(state, LINE_B)
    const restored = JSON.parse(JSON.stringify(state)) as GameState
    expect(restored.junctions).toEqual(state.junctions)

    // migration path: wipe and recompute from built trails
    const migrated = JSON.parse(JSON.stringify(state)) as GameState
    rebuildJunctions(migrated)
    expect(Object.values(migrated.junctions).length).toBe(Object.values(state.junctions).length)
    for (const j of Object.values(migrated.junctions)) expect(j.legs.length).toBe(2)
  })
})

describe('endpoint merges', () => {
  it('a run ending on another trail merges into it at a junction', () => {
    const state = withLifts()
    expect(buildCustomTrail(state, LINE_A)).toBeNull()

    // from the left lift top, ending exactly on LINE_A mid-slope
    const onA = nearestOnTrail(state, { x: 925, y: 800 }, 40)!
    expect(onA).not.toBeNull()
    const merger: Vec2[] = [{ x: 760, y: 520 }, { x: 850, y: 660 }, onA.pos]

    const plan = planCustomTrail(state, merger)
    expect(plan.conflicts.bottomMerge?.trailId).toBe(trailIdByPath(state, LINE_A))
    // merge suppresses the dead-end warning
    expect(plan.warnings.some((w) => w.includes('dead-ends'))).toBe(false)

    expect(buildCustomTrail(state, merger)).toBeNull()
    const c = Object.values(state.customTrailDefs).find((d) => d.topNodeId === leftTopId(state))!
    expect(c.bottomNodeId).not.toBe('')
    expect(state.junctions[c.bottomNodeId]).toBeDefined()
    expect(state.junctions[c.bottomNodeId].legs[0].trailId).toBe(trailIdByPath(state, LINE_A))
  })

  it('skiers finishing a merged run continue down the host line', () => {
    const state = withLifts()
    buildCustomTrail(state, LINE_A)
    const onA = nearestOnTrail(state, { x: 925, y: 800 }, 40)!
    buildCustomTrail(state, [{ x: 760, y: 520 }, { x: 850, y: 660 }, onA.pos])

    openResort(state)
    fastForwardDay(state)

    const merged = Object.values(state.customTrailDefs).find((d) => d.topNodeId === leftTopId(state))!
    expect(state.trails[merged.id].ridesToday).toBeGreaterThan(0)
    // nobody got stranded at the junction
    const stranded = state.departedToday.filter((g) => g.memories.some((m) => m.kind === 'stranded'))
    expect(stranded.length).toBe(0)
  })
})

describe('overlap rejection', () => {
  it('refuses a line that rides down an existing corridor', () => {
    const state = withLifts()
    expect(buildCustomTrail(state, LINE_A)).toBeNull()
    const shadow: Vec2[] = [
      { x: 880, y: 460 },
      { x: 945, y: 705 },
      { x: 905, y: 895 },
      { x: 950, y: 1040 },
    ]
    const err = buildCustomTrail(state, shadow)
    expect(err).not.toBeNull()
    expect(err).toMatch(/Runs down|grazing/)
    // and nothing was half-built
    expect(Object.keys(state.customTrailDefs).length).toBe(1)
    expect(Object.keys(state.junctions).length).toBe(0)
  })
})

describe('determinism with junctions', () => {
  it('same seed, same junction network, same day', () => {
    const build = () => {
      const state = withLifts()
      buildCustomTrail(state, LINE_A)
      buildCustomTrail(state, LINE_B)
      const onA = nearestOnTrail(state, { x: 925, y: 800 }, 40)!
      buildCustomTrail(state, [{ x: 760, y: 520 }, { x: 850, y: 660 }, onA.pos])
      return state
    }
    const a = build()
    const b = build()
    openResort(a)
    openResort(b)
    fastForwardDay(a)
    fastForwardDay(b)
    expect(JSON.parse(JSON.stringify(a))).toEqual(JSON.parse(JSON.stringify(b)))
  })

  it('mid-run switching happens: a crossing line collects riders from the other', () => {
    const state = withLifts()
    buildCustomTrail(state, LINE_A)
    buildCustomTrail(state, LINE_B)
    openResort(state)
    fastForwardDay(state)
    const a = state.trails[trailIdByPath(state, LINE_A)]
    const b = state.trails[trailIdByPath(state, LINE_B)]
    expect(a.ridesToday + b.ridesToday).toBeGreaterThan(0)
    const def = getTrailDef(state, a.trailId)
    expect(def).toBeDefined()
  })
})
