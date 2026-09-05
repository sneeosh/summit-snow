import { expect, it } from 'vitest'
import { newGame } from './init'
import { proposeTownProject } from './actions'
import { townBenefits, townProposal, townStage } from './town'
import { openResort, fastForwardDay, startNextDay } from './simulation'
import { buyResort, switchResort } from './company'
import { settleDay, computeDailyDemand } from './economy'
import { Rng } from './rng'
import type { GameState, TownProject } from './types'

it('previews council opposition and rejects proposals without taking money',()=>{
 const s=newGame('sandbox',71,'prairie')
 expect(townProposal(s,'inn').approved).toBe(false)
 const before=JSON.stringify(s)
 expect(proposeTownProject(s,'inn')).toContain('Council declined')
 expect(JSON.stringify(s)).toBe(before)
 expect(townProposal(s,'inn',true).approved).toBe(true)
 expect(proposeTownProject(s,'inn',true)).toBeNull()
 expect(s.cash).toBe(380_000-83_000)
 expect(s.town.construction?.homes).toBe(true)
 const busy=JSON.stringify(s)
 expect(proposeTownProject(s,'housing')).not.toBeNull()
 expect(JSON.stringify(s)).toBe(busy)
})
it('construction completes after operating days, adds a landmark and applies benefits once',()=>{
 const s=newGame('sandbox',71,'prairie')
 proposeTownProject(s,'housing')
 const before=JSON.stringify(s)
 startNextDay(s)
 expect(JSON.stringify(s)).toBe(before)
 for(let d=0;d<3;d++){
  expect(townBenefits(s).payrollDiscount).toBe(0)
  openResort(s);fastForwardDay(s);startNextDay(s)
 }
 expect(s.town.levels.housing).toBe(1)
 expect(s.town.construction).toBeNull()
 expect(s.town.lastOpening).toEqual({project:'housing',level:1,day:4,season:1})
 expect(townBenefits(s).payrollDiscount).toBe(.035)
 const {report}=settleDay(s,new Rng(2))
 expect(report.expenses.payroll).toBeCloseTo(s.staff.reduce((n,d)=>n+d.dailyWage*d.headcount,0)*.965)
 expect(JSON.parse(JSON.stringify(s))).toEqual(s)
})
it('completed lodging and main-street investments raise demand and shuttle capacity',()=>{
 const s=newGame('sandbox',71,'prairie'), demand=computeDailyDemand(s)
 s.town.levels={inn:1,housing:0,shuttle:1,mainstreet:1}
 expect(townBenefits(s)).toMatchObject({beds:48,transport:80,dailyCost:220})
 expect(computeDailyDemand(s)).toBeGreaterThan(demand)
})
it('insufficient funds, late council meetings and invalid compacts are atomic',()=>{
 const s=newGame('sandbox',71,'prairie');s.cash=0
 let before=JSON.stringify(s)
 expect(proposeTownProject(s,'housing')).not.toBeNull()
 expect(JSON.stringify(s)).toBe(before)
 s.cash=100_000;s.phase='operating';before=JSON.stringify(s)
 expect(proposeTownProject(s,'housing')).not.toBeNull()
 expect(JSON.stringify(s)).toBe(before)
 s.phase='planning';before=JSON.stringify(s)
 expect(proposeTownProject(s,'housing',true)).not.toBeNull()
 expect(JSON.stringify(s)).toBe(before)
})
it.each(['prairie','granite','alder','yuki','kea','elk','wasatch','blanche'])('has a reachable council development path on %s',id=>{
 const s=newGame('sandbox',71,id);s.cash=3_000_000
 // Isolate votes and construction from the separate operating economy tests.
 for(const project of ['housing','shuttle','mainstreet','inn'] as TownProject[])for(let level=1;level<=3;level++){
  expect(proposeTownProject(s,project,project==='inn')).toBeNull()
  const days=s.town.construction!.totalDays
  for(let d=0;d<days;d++){s.phase='day-end';startNextDay(s)}
  expect(s.town.levels[project]).toBe(level)
 }
 expect(townStage(s)).toBe('Alpine destination')
 expect(townBenefits(s).payrollDiscount).toBe(.15)
 expect(proposeTownProject(s,'inn',true)).not.toBeNull()
})
it('keeps independent towns when switching holdings and survives a season boundary',()=>{
 const s=newGame('sandbox',71,'prairie');s.cash=2_000_000
 proposeTownProject(s,'housing')
 s.day=60;s.phase='day-end';startNextDay(s)
 expect(s.season).toBe(2)
 expect(s.town.construction?.remainingDays).toBe(2)
 buyResort(s,'kea')
 const kea=switchResort(s,'kea') as GameState
 expect(kea.town.construction).toBeNull()
 expect(kea.town.levels.housing).toBe(0)
 const back=switchResort(kea,'prairie') as GameState
 expect(back.town.construction?.remainingDays).toBe(2)
})
