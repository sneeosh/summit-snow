import { describe, expect, it } from 'vitest'
import { buildCustomLift, buildCustomTrail, buildLift, setStaffCount, takeLoan } from './actions'
import { planLifts } from './guests'
import { newGame } from './init'
import { fastForwardDay, openResort } from './simulation'
import { elevationAt, scatterTrees, treesInCorridor } from './terrainModel'
import { analyzePath, getLiftSite, getNode, getTrailDef, planCustomLift, planCustomTrail } from './trails'
import type { GameState, Vec2 } from './types'

// mid station (800,560) → base (950,1040): a clean fall-line descent
const CLEAN_LINE: Vec2[] = [
  { x: 800, y: 560 },
  { x: 860, y: 720 },
  { x: 900, y: 880 },
  { x: 950, y: 1040 },
]

// climbs back up in the middle
const UPHILL_LINE: Vec2[] = [
  { x: 800, y: 560 },
  { x: 880, y: 780 },
  { x: 920, y: 700 }, // ← back uphill
  { x: 950, y: 1040 },
]

// starts at mid but ends in the middle of nowhere
const DEAD_END_LINE: Vec2[] = [
  { x: 800, y: 560 },
  { x: 700, y: 700 },
  { x: 620, y: 760 },
]

describe('terrain model', () => {
  it('elevation decreases downhill (increasing y)', () => {
    expect(elevationAt({ x: 940, y: 170 })).toBeCloseTo(2350, 0)
    expect(elevationAt({ x: 950, y: 1040 })).toBeCloseTo(1250, 0)
    expect(elevationAt({ x: 0, y: 500 })).toBeGreaterThan(elevationAt({ x: 0, y: 900 }))
  })

  it('forest is deterministic and clearable', () => {
    const a = scatterTrees(42)
    const b = scatterTrees(42)
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(200)
    // a wide corridor across the forest belt catches trees
    const band = treesInCorridor(42, [{ x: 400, y: 700 }, { x: 1500, y: 700 }], 40)
    expect(band.length).toBeGreaterThan(0)
  })
})

describe('path analysis', () => {
  it('grades a clean fall-line descent with no uphill', () => {
    const a = analyzePath(CLEAN_LINE)
    expect(a.uphillSegments).toEqual([])
    expect(a.totalClimbM).toBe(0)
    expect(a.verticalM).toBeGreaterThan(400)
    expect(a.topNodeId).toBe('mid')
    expect(a.bottomNodeId).toBe('base')
  })

  it('detects uphill stretches', () => {
    const a = analyzePath(UPHILL_LINE)
    expect(a.uphillSegments.length).toBeGreaterThan(0)
    expect(a.totalClimbM).toBeGreaterThan(50)
    expect(a.uphillFraction).toBeGreaterThan(0)
  })

  it('flags detached endpoints', () => {
    const a = analyzePath(DEAD_END_LINE)
    expect(a.topNodeId).toBe('mid')
    expect(a.bottomNodeId).toBeNull()
  })

  it('steeper lines grade harder', () => {
    // long meander vs straight plunge over the same vertical
    const gentle = analyzePath([
      { x: 800, y: 560 },
      { x: 400, y: 640 },
      { x: 1100, y: 720 },
      { x: 500, y: 800 },
      { x: 950, y: 1040 },
    ])
    const steep = analyzePath([
      { x: 800, y: 560 },
      { x: 810, y: 800 },
      { x: 820, y: 1040 },
    ])
    const order = { green: 0, blue: 1, black: 2, 'double-black': 3 }
    expect(order[steep.difficulty]).toBeGreaterThanOrEqual(order[gentle.difficulty])
  })
})

describe('building custom trails', () => {
  function fundedGame(): GameState {
    const g = newGame('scenario', 42)
    takeLoan(g, 'expansion')
    return g
  }

  it('charges groundwork plus tree clearing and creates a working trail', () => {
    const g = fundedGame()
    const plan = planCustomTrail(g, CLEAN_LINE)
    expect(plan.totalCost).toBe(plan.groundworkCost + plan.clearingCost)
    expect(plan.groundworkCost).toBeGreaterThan(0)

    const cashBefore = g.cash
    expect(buildCustomTrail(g, CLEAN_LINE)).toBeNull()
    expect(g.cash).toBe(cashBefore - plan.totalCost)

    const id = Object.keys(g.customTrailDefs)[0]
    expect(g.trails[id].built).toBe(true)
    const def = getTrailDef(g, id)
    expect(def.isCustom).toBe(true)
    expect(def.topNodeId).toBe('mid')
    expect(def.bottomNodeId).toBe('base')
  })

  it('rejects a two-metre nothing but allows a flawed line', () => {
    const g = fundedGame()
    expect(buildCustomTrail(g, [{ x: 800, y: 560 }, { x: 802, y: 562 }])).toContain('longer')
    // uphill and dead-end lines are the designer's prerogative
    expect(buildCustomTrail(g, UPHILL_LINE)).toBeNull()
    expect(buildCustomTrail(g, DEAD_END_LINE)).toBeNull()
  })

  it('does not double-charge trees where corridors overlap', () => {
    const g = fundedGame()
    const first = planCustomTrail(g, UPHILL_LINE)
    buildCustomTrail(g, UPHILL_LINE)
    const overlapping = planCustomTrail(g, UPHILL_LINE)
    expect(overlapping.treesToClear).toBeLessThanOrEqual(first.treesToClear)
    expect(overlapping.treesToClear).toBe(0)
  })

  it('rejects lifts without rise; prices by length and clears trees', () => {
    const g = fundedGame()
    // flat line along the village: no rise
    expect(buildCustomLift(g, { x: 700, y: 1020 }, { x: 1100, y: 1020 }, 'chair')).toContain('rise')

    const plan = planCustomLift(g, { x: 950, y: 1040 }, { x: 600, y: 400 }, 'chair')
    expect(plan.riseM).toBeGreaterThan(100)
    expect(plan.lengthM).toBeGreaterThan(800)
    expect(plan.totalCost).toBe(plan.lineCost + plan.clearingCost)
  })

  it('builds point-to-point, auto-orients, and creates network nodes', () => {
    const g = fundedGame()
    const cashBefore = g.cash
    // clicked top-first on purpose — the lower end must become the bottom
    expect(buildCustomLift(g, { x: 600, y: 400 }, { x: 950, y: 1040 }, 'chair')).toBeNull()
    expect(g.cash).toBeLessThan(cashBefore)

    const id = Object.keys(g.customLiftSites)[0]
    const site = getLiftSite(g, id)
    expect(site.bottomNodeId).toBe('base') // snapped to the village
    const top = getNode(g, site.topNodeId)!
    expect(top.id.startsWith('cn-')).toBe(true) // new station created
    expect(top.elevation).toBeGreaterThan(getNode(g, 'base')!.elevation)
    expect(g.lifts[id].open).toBe(true)

    // the new station is routable
    setStaffCount(g, 'lift-ops', 4)
    expect(planLifts(g, 'base', site.topNodeId)).toEqual([id])
  })

  it('custom lift + custom trail compose into a working circuit', () => {
    const g = fundedGame()
    takeLoan(g, 'operating')
    expect(buildCustomLift(g, { x: 950, y: 1040 }, { x: 620, y: 450 }, 'chair')).toBeNull()
    const site = getLiftSite(g, Object.keys(g.customLiftSites)[0])
    const top = getNode(g, site.topNodeId)!
    // draw a run from the new top station back to the village
    expect(buildCustomTrail(g, [top.pos, { x: 780, y: 760 }, { x: 950, y: 1040 }])).toBeNull()
    const trailId = Object.keys(g.customTrailDefs)[0]
    expect(getTrailDef(g, trailId).topNodeId).toBe(site.topNodeId)

    setStaffCount(g, 'lift-ops', 4)
    setStaffCount(g, 'grooming', 2)
    openResort(g)
    fastForwardDay(g)
    expect(g.trails[trailId].ridesToday).toBeGreaterThan(0)
  })

  it('skiers use a clean custom trail; flawed ones breed complaints', () => {
    const g = fundedGame()
    buildLift(g, 'alder-chair', 'chair')
    setStaffCount(g, 'lift-ops', 4)
    setStaffCount(g, 'grooming', 2)
    expect(buildCustomTrail(g, CLEAN_LINE)).toBeNull()
    expect(buildCustomTrail(g, DEAD_END_LINE)).toBeNull()
    const ids = Object.keys(g.customTrailDefs)

    openResort(g)
    fastForwardDay(g)

    const rides = ids.map((id) => g.trails[id].ridesToday)
    expect(rides[0]).toBeGreaterThan(0) // the clean line gets skied

    // if anyone skied the dead end, they got stranded and complained
    if (rides[1] > 0) {
      const strandedComplaints = g.reports[0].complaints.some((c) => c.text.includes('dead-end'))
      expect(strandedComplaints).toBe(true)
    }
  })
})
