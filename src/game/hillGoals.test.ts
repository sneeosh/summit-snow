import { expect, it } from 'vitest'
import { hillGoals } from './hillGoals'
import { newGame } from './init'
import { openResort, fastForwardDay, startNextDay } from './simulation'

it('does not count a closed lift network toward terrain goals', () => {
 const state = newGame('sandbox',71,'granite')
 for (const lift of Object.values(state.lifts)) lift.open = false
 expect(hillGoals(state).find(o => o.id === 'groomed')?.progress).toBe(0)
 for (const lift of Object.values(state.lifts)) lift.open = true
 for (const trail of Object.values(state.trails)) trail.surface = 'groomed'
 openResort(state)
 expect(hillGoals(state).find(o => o.id === 'groomed')?.progress).toBeGreaterThan(0)
})

it.each(['prairie','granite','alder','yuki','kea','elk','wasatch','blanche'])('operates a complete season and rolls into the next on %s', id => {
 const state = newGame('sandbox',91,id)
 // Isolate operational stability from acquisition cost and starter profitability.
 state.cash = 5_000_000
 for (let day=0;day<60;day++) {
  openResort(state); fastForwardDay(state)
  expect(state.phase).toBe('day-end')
  expect(Number.isFinite(state.cash)).toBe(true)
  expect(hillGoals(state).every(o => Number.isFinite(o.progress))).toBe(true)
  startNextDay(state)
 }
 expect(state.season).toBe(2)
 expect(state.day).toBe(1)
 expect(state.reports.some(r => r.guestsServed > 0)).toBe(true)
 expect(JSON.parse(JSON.stringify(state))).toEqual(state)
}, 30000)
