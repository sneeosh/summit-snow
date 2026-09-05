import { describe, expect, it } from 'vitest'
import { ACTIVE_MOUNTAIN, ensureMountain, NODE_MAP } from '../content/mountain'
import { LEGACY_MOUNTAIN_MAP, MOUNTAIN_MAP } from '../content/mountains'
import { buildCustomLift, setGroomingPolicy } from './actions'
import { buyResort, switchResort } from './company'
import { mountainElevation } from './elevation'
import { newGame } from './init'
import { tickLifts } from './lifts'
import { Rng } from './rng'
import { openResort, fastForwardDay, startNextDay } from './simulation'
import { routeWindMultiplier, scatterTrees } from './terrainModel'
import { analyzePath } from './trails'
import type { GameState, WeatherDay } from './types'
import { processOvernight, surfaceEnjoyment } from './weather'

describe('mountain identities', () => {
  it('starts each hill with distinct, downhill, genuinely green routes connected to its lift', () => {
    const geometries = new Set<string>()
    for (const id of ['prairie', 'yuki', 'kea']) {
      const game = newGame('sandbox', 71, id)
      const m = ACTIVE_MOUNTAIN
      geometries.add(JSON.stringify(m.trails.map((t) => t.path)))
      expect(game.mountainVersion).toBe(2)
      for (const node of m.nodes) expect(node.elevation).toBeCloseTo(mountainElevation(m, node.pos))
      for (const trail of m.trails) {
        const analysis = analyzePath(trail.path)
        expect(analysis.difficulty, `${id}: ${trail.name}`).toBe('green')
        expect(analysis.totalClimbM, `${id}: ${trail.name}`).toBe(0)
        expect(analysis.topNodeId).toBe('beginner-top')
        expect(analysis.bottomNodeId).toBe('base')
        expect(trail.path.at(-1)).toEqual(NODE_MAP.base.pos)
        expect(game.trails[trail.id].built).toBe(true)
      }
      expect(m.facilitySlots.filter((s) => s.id.startsWith('v')).every((s) => s.pos.y > 1040)).toBe(true)
    }
    expect(geometries.size).toBe(3)
  })

  it('detects a ridge between two waypoints, including the uphill approach', () => {
    newGame('sandbox', 71, 'kea')
    const p = [{ x: 1000, y: 640 }, { x: 1600, y: 640 }]
    const a = analyzePath(p)
    expect(a.totalClimbM).toBeGreaterThan(100)
    expect(a.uphillSegments.length).toBeGreaterThan(0)
    expect(a.difficulty).not.toBe('green')
    const split = analyzePath([p[0], { x: 1300, y: 640 }, p[1]])
    expect(Math.abs(split.totalClimbM - a.totalClimbM)).toBeLessThan(2)
  })

  it('holds an exposed Kea chair while a sheltered chair keeps running', () => {
    const game = newGame('sandbox', 71, 'kea')
    game.cash = 2_000_000
    const sheltered = [{ x: 620, y: 810 }, { x: 620, y: 560 }]
    const exposed = [{ x: 1300, y: 810 }, { x: 1300, y: 560 }]
    expect(routeWindMultiplier(sheltered)).toBeLessThan(1)
    expect(routeWindMultiplier(exposed)).toBeGreaterThan(1.3)
    expect(buildCustomLift(game, sheltered[0], sheltered[1], 'chair')).toBeNull()
    expect(buildCustomLift(game, exposed[0], exposed[1], 'chair')).toBeNull()
    game.weatherSeason[0].windKph = 45
    tickLifts(game, new Rng(9))
    const custom = Object.values(game.lifts).filter((l) => l.kind === 'chair')
    expect(custom[0].forcedClosed).toBeNull()
    expect(custom[1].forcedClosed).toBe('wind')
  })

  it('grooms the learning route while preserving powder on the other run', () => {
    const game = newGame('sandbox', 71, 'yuki')
    const m = ACTIVE_MOUNTAIN
    expect(setGroomingPolicy(game, 'meadow-loop', 'preserve')).toBeNull()
    const powder: WeatherDay = { day: 2, tempLow: -10, tempHigh: -4, snowfallCm: 25,
      windKph: 12, cloud: 0.8, visibility: 0.6, summary: 'Heavy snow' }
    processOvernight(game.trails, powder, { groomerCapacity: 8, snowmakingCapacity: 0, snowmakingBoost: 1, snowBonusCm: 0 },
      (id) => m.trails.find((t) => t.id === id)!)
    expect(game.trails.bunny.surface).toBe('groomed')
    expect(game.trails['meadow-loop'].surface).toBe('fresh-powder')
    expect(game.trails['meadow-loop'].groomedOvernight).toBe(false)
    expect(surfaceEnjoyment('groomed', 'beginner')).toBeGreaterThan(surfaceEnjoyment('fresh-powder', 'beginner'))
    expect(surfaceEnjoyment('fresh-powder', 'expert')).toBeGreaterThan(surfaceEnjoyment('groomed', 'expert'))
  })

  it('keeps legacy and redesigned geometry and forests separate when switching', () => {
    const game = newGame('sandbox', 71, 'prairie')
    game.mountainVersion = 1
    ensureMountain('prairie', 1)
    const oldForest = scatterTrees(71)
    expect(ACTIVE_MOUNTAIN).toBe(LEGACY_MOUNTAIN_MAP.prairie)
    expect(NODE_MAP.base.pos).toEqual({ x: 950, y: 1040 })
    game.cash = 2_000_000
    buyResort(game, 'kea')
    const kea = switchResort(game, 'kea') as GameState
    expect(kea.mountainVersion).toBe(2)
    expect(ACTIVE_MOUNTAIN).toBe(MOUNTAIN_MAP.kea)
    switchResort(kea, 'prairie')
    expect(ACTIVE_MOUNTAIN).toBe(LEGACY_MOUNTAIN_MAP.prairie)
    expect(scatterTrees(71)).toBe(oldForest)
    ensureMountain('prairie', 2)
    expect(scatterTrees(71)).not.toBe(oldForest)
  })

  it.each(['prairie', 'yuki', 'kea'])('runs a deterministic three-day operating cycle on %s', (id) => {
    function run() {
      const game = newGame('sandbox', 91, id)
      game.cash = 1_000_000
      setGroomingPolicy(game, 'meadow-loop', 'preserve')
      for (let i = 0; i < 3; i++) {
        openResort(game); fastForwardDay(game)
        if (i < 2) startNextDay(game)
      }
      return game
    }
    const a = run(), b = run()
    expect(a).toEqual(b)
    expect(a.reports).toHaveLength(3)
    expect(a.reports[0].guestsServed).toBeGreaterThan(0)
    expect(JSON.parse(JSON.stringify(a))).toEqual(a)
  })
})
