import { expect, it } from 'vitest'
import { buildCustomLift, buildCustomTrail, setStaffCount } from './actions'
import { nearestOnTrail } from './junctions'
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

it('counts an operating lift whose return merges into another open trail', () => {
 const state = newGame('sandbox',7,'alder')
 state.cash=5_000_000
 expect(buildCustomLift(state,{x:950,y:1040},{x:880,y:460},'chair')).toBeNull()
 expect(buildCustomLift(state,{x:700,y:1030},{x:760,y:520},'chair')).toBeNull()
 expect(setStaffCount(state,'lift-ops',10)).toBeNull()
 expect(buildCustomTrail(state,[{x:880,y:460},{x:950,y:700},{x:900,y:900},{x:950,y:1040}])).toBeNull()
 const merge=nearestOnTrail(state,{x:925,y:800},40)!
 expect(buildCustomTrail(state,[{x:760,y:520},{x:850,y:660},merge.pos])).toBeNull()
 // Starter lift is intentionally closed: both new chairs have valid ways home.
 expect(hillGoals(state).find(o=>o.id==='lifts')?.progress).toBeCloseTo(2/3)
 const host=Object.values(state.customTrailDefs).find(t=>t.path[0].x===880)!
 state.trails[host.id].open=false
 expect(hillGoals(state).find(o=>o.id==='lifts')?.progress).toBe(0)
})
