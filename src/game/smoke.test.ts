/**
 * Cross-mountain smoke: every mountain in the roster runs several full days
 * with a basic build-out and never produces NaN money, stuck guests, negative
 * snow, or a wedged phase. This codifies the fuzz sweep that used to live in
 * a throwaway script — content authoring mistakes should fail here, not on
 * someone's phone.
 */
import { describe, expect, it } from 'vitest'
import * as actions from './actions'
import { MOUNTAINS } from '../content/mountains'
import { newGame } from './init'
import { liftStaffRequired } from './resort'
import { fastForwardDay, openResort, startNextDay } from './simulation'

describe('every mountain survives operation', () => {
  for (const m of MOUNTAINS) {
    it(`${m.name} runs 3 days without breaking an invariant`, () => {
      const s = newGame('sandbox', 19, m.id)
      s.cash = 400_000
      // a plausible first build: chair up the hill, a run back, gear rental
      actions.buildCustomLift(s, { x: 950, y: 1040 }, { x: 860, y: Math.max(m.ySummit + 60, 640) }, 'chair')
      actions.buildCustomTrail(s, [
        { x: 860, y: Math.max(m.ySummit + 60, 640) },
        { x: 940, y: 800 },
        { x: 880, y: 930 },
        { x: 950, y: 1040 },
      ])
      actions.buildFacility(s, 'v3', 'rental-shop')
      actions.setStaffCount(s, 'rental', 3)
      actions.setStaffCount(s, 'lift-ops', liftStaffRequired(s))
      if (s.lifts['starter-carpet']) actions.setLiftOpen(s, 'starter-carpet', true)
      if (s.lifts['meadow-carpet']) actions.setLiftOpen(s, 'meadow-carpet', true)

      for (let d = 0; d < 3; d++) {
        openResort(s)
        fastForwardDay(s)
        const report = s.reports[s.reports.length - 1]
        expect(Number.isFinite(s.cash), 'cash finite').toBe(true)
        expect(Number.isFinite(report.netProfit), 'profit finite').toBe(true)
        expect(Number.isFinite(report.avgSatisfaction), 'satisfaction finite').toBe(true)
        expect(Object.keys(s.guests).length, 'everyone goes home at night').toBe(0)
        for (const t of Object.values(s.trails)) {
          expect(Number.isFinite(t.snowDepthCm) && t.snowDepthCm >= 0, `snow depth sane on ${t.trailId}`).toBe(true)
        }
        expect(s.phase).toBe('day-end')
        startNextDay(s)
        expect(s.phase).toBe('planning')
      }
      // someone actually skied
      expect(s.reports.some((r) => r.guestsServed > 0)).toBe(true)
    })
  }
})
