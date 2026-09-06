import { describe, expect, it } from 'vitest'
import { MOUNTAINS } from '../content/mountains'
import { setLiftOpen } from './actions'
import { newGame } from './init'
import { fastForwardDay, openResort } from './simulation'

describe('starter runs need no expansion to support skiing', () => {
  for (const mountain of MOUNTAINS) {
    it(`${mountain.name}: opening the starter lift produces completed runs`, () => {
      const game = newGame('sandbox', 19, mountain.id)
      const lifts = Object.values(game.lifts)
      expect(lifts.length).toBeGreaterThan(0)
      expect(lifts.every(lift => !lift.open)).toBe(true)
      // Isolate the starter route from random weather and morning faults.
      Object.assign(game.weatherSeason[0], { windKph: 0, snowfallCm: 0, tempHigh: -4, tempLow: -8 })
      for (const lift of lifts) expect(setLiftOpen(game, lift.siteId, true)).toBeNull()
      openResort(game)
      for (const lift of lifts) lift.forcedClosed = null
      fastForwardDay(game)
      expect(lifts.reduce((sum, lift) => sum + lift.totalRidesToday, 0)).toBeGreaterThan(0)
      expect(Object.values(game.trails).reduce((sum, trail) => sum + trail.ridesToday, 0)).toBeGreaterThan(0)
    })
  }
})
