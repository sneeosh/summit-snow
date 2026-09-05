import { expect, it } from 'vitest'
import { NIGHT_END_MIN, NIGHT_LIGHTING_COST, AVALANCHE_CONTROL_COST_PER_RUN } from '../content/balance'
import { installNightLighting, setNightSkiing, controlAvalanches, buildCustomLift, buildCustomTrail, setStaffCount, setTrailOpen } from './actions'
import { developmentValue } from './company'
import { settleDay } from './economy'
import { newGame } from './init'
import { avalancheHeld, avalancheRisk, closingMinute } from './operations'
import { openResort, fastForwardDay, startNextDay } from './simulation'
import { spawnArrivals } from './guests'
import { Rng } from './rng'

it('charges once for lighting, permits Prairie only, and locks hours after opening',()=>{
 const s=newGame('sandbox',71,'prairie'), cash=s.cash
 const development = developmentValue(s)
 expect(installNightLighting(s)).toBeNull()
 expect(s.cash).toBe(cash-NIGHT_LIGHTING_COST)
 expect(developmentValue(s)).toBe(development+NIGHT_LIGHTING_COST)
 expect(installNightLighting(s)).not.toBeNull()
 expect(s.cash).toBe(cash-NIGHT_LIGHTING_COST)
 expect(setNightSkiing(s,true)).toBeNull()
 expect(closingMinute(s)).toBe(NIGHT_END_MIN)
 openResort(s)
 expect(setNightSkiing(s,false)).not.toBeNull()
 const other=newGame('sandbox',71,'granite'), unchanged=JSON.stringify(other)
 expect(installNightLighting(other)).not.toBeNull()
 expect(JSON.stringify(other)).toBe(unchanged)
})
it('spawns the evening crowd only on a booked night shift',()=>{
 const night=newGame('sandbox',71,'prairie')
 installNightLighting(night);setNightSkiing(night,true)
 night.targetDemandToday=100;night.arrivalCarry=.99;night.minute=18*60
 spawnArrivals(night,new Rng(4))
 expect(night.guestsArrivedToday).toBe(1)
 const day=newGame('sandbox',71,'prairie')
 day.targetDemandToday=100;day.arrivalCarry=.99;day.minute=18*60
 spawnArrivals(day,new Rng(4))
 expect(day.guestsArrivedToday).toBe(0)
})
it('finishes a deterministic night, pays the longer shift and rolls to morning',()=>{
 const run=()=>{
  const s=newGame('sandbox',71,'prairie')
  installNightLighting(s);setNightSkiing(s,true)
  Object.values(s.lifts).forEach(l=>l.open=true)
  openResort(s);fastForwardDay(s)
  return s
 }
 const s=run()
 expect(s).toEqual(run())
 expect(s.phase).toBe('day-end')
 expect(s.minute).toBeGreaterThanOrEqual(NIGHT_END_MIN)
 expect(s.reports[0].expenses.payroll).toBe(Math.round(s.staff.reduce((sum,d)=>sum+d.headcount*d.dailyWage,0)*1.5))
 expect(JSON.parse(JSON.stringify(s))).toEqual(s)
 startNextDay(s)
 expect(s.minute).toBe(510)
 expect(setNightSkiing(s,false)).toBeNull()
 expect(closingMinute(s)).toBe(990)
})
function stormHill(){
 const s=newGame('sandbox',71,'kea');s.cash=2_000_000
 Object.assign(s.weatherSeason[0],{snowfallCm:35,windKph:20,tempHigh:-4})
 expect(buildCustomLift(s,{x:1390,y:1040},{x:1700,y:680},'chair')).toBeNull()
 expect(buildCustomTrail(s,[{x:1700,y:680},{x:1800,y:860},{x:1390,y:1040}])).toBeNull()
 return {s,id:Object.keys(s.customTrailDefs)[0]}
}
it('holds storm-loaded expert terrain until staffed, paid control; greens stay available',()=>{
 const {s,id}=stormHill()
 expect(avalancheRisk(s,id)).toBe('high')
 expect(avalancheRisk(s,'bunny')).toBe('low')
 expect(s.trails[id].open).toBe(false)
 expect(setTrailOpen(s,id,true)).not.toBeNull()
 const before=JSON.stringify(s)
 expect(controlAvalanches(s)).not.toBeNull()
 expect(JSON.stringify(s)).toBe(before)
 setStaffCount(s,'patrol',3)
 const cash=s.cash
 expect(controlAvalanches(s)).toBeNull()
 expect(s.cash).toBe(cash-AVALANCHE_CONTROL_COST_PER_RUN)
 expect(setTrailOpen(s,id,true)).toBeNull()
 expect(controlAvalanches(s)).not.toBeNull()
 expect(s.cash).toBe(cash-AVALANCHE_CONTROL_COST_PER_RUN)
 openResort(s)
 expect(s.trails[id].open).toBe(true)
 expect(controlAvalanches(s)).not.toBeNull()
 s.phase='day-end'
 Object.assign(s.weatherSeason[1],{snowfallCm:35,windKph:20,tempHigh:-4})
 startNextDay(s)
 expect(avalancheHeld(s,id)).toBe(true)
 expect(s.trails[id].open).toBe(false)
})
it('control does not grant clearance to terrain added later that morning',()=>{
 const {s,id}=stormHill();setStaffCount(s,'patrol',3);controlAvalanches(s)
 s.customTrailDefs.later={...s.customTrailDefs[id],id:'later'}
 s.trails.later={...s.trails[id],trailId:'later'}
 expect(avalancheHeld(s,id)).toBe(false)
 expect(avalancheHeld(s,'later')).toBe(true)
 const cash=s.cash
 expect(controlAvalanches(s)).toBeNull()
 expect(s.cash).toBe(cash-AVALANCHE_CONTROL_COST_PER_RUN)
})

it('records control as an operating expense without charging twice',()=>{
 const {s}=stormHill();setStaffCount(s,'patrol',3);controlAvalanches(s)
 const cash=s.cash
 const {report,operatingProfit}=settleDay(s,new Rng(9))
 const e=report.expenses
 expect(e.other).toBe(AVALANCHE_CONTROL_COST_PER_RUN)
 expect(s.cash).toBe(cash-e.payroll-e.maintenance-e.energy-e.facilities)
 expect(operatingProfit).toBe(-(e.payroll+e.maintenance+e.energy+e.facilities+e.other))
})
