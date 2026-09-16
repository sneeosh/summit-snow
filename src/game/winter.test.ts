import { describe, expect, it } from 'vitest'
import { newGame } from './init'
import { demandExplanation } from './economy'
import { setAdmission, restoreThinRun, setLiftOpen } from './actions'
import { openResort, fastForwardDay, startNextDay } from './simulation'
import { WINTER, TRAIL_MIN_DEPTH_CM } from '../content/balance'
import { returningMultiplier, settleWinter } from './winter'
import { townProposal } from './town'

describe('winter outcomes',()=>{
  it('promotions obey arrival capacity and comfortable admission is a genuine volume tradeoff',()=>{
    const s=newGame('scenario',91);s.demandMultTomorrow=10
    const full=demandExplanation(s)
    expect(full.interested).toBeGreaterThan(full.capacity)
    expect(full.admitted).toBe(full.capacity)
    expect(setAdmission(s,'comfortable')).toBeNull()
    expect(demandExplanation(s).admitted).toBe(Math.floor(full.capacity*WINTER.comfortableCapacity))
    openResort(s)
    const before=JSON.stringify(s)
    expect(setAdmission(s,'welcome')).not.toBeNull();expect(JSON.stringify(s)).toBe(before)
  })
  it('recovery is paid once, recorded as expense once, leaves reopening explicit, and rejects atomically',()=>{
    const s=newGame('scenario',91),t=Object.values(s.trails).find(t=>t.built)!
    t.snowDepthCm=5;t.open=false
    const cash=s.cash
    expect(restoreThinRun(s,t.trailId)).toBeNull()
    expect(s.cash).toBe(cash-WINTER.recoveryCost)
    expect(t.snowDepthCm).toBeGreaterThanOrEqual(TRAIL_MIN_DEPTH_CM)
    expect(t.open).toBe(false)
    const snapshot=JSON.stringify(s)
    expect(restoreThinRun(s,t.trailId)).not.toBeNull();expect(JSON.stringify(s)).toBe(snapshot)
    openResort(s);fastForwardDay(s)
    expect(s.reports.at(-1)!.expenses.other).toBeGreaterThanOrEqual(WINTER.recoveryCost)
    startNextDay(s);expect(s.winter.recoverySpendToday).toBe(0)
  })
  it('audience feedback is bounded, save-roundtrip deterministic, and the opening portrait stays frozen',()=>{
    const a=newGame('scenario',91);setLiftOpen(a,'meadow-carpet',true)
    const opening=JSON.stringify(a.winter.opening)
    openResort(a)
    const b=JSON.parse(JSON.stringify(a))
    fastForwardDay(a);fastForwardDay(b)
    expect(a).toEqual(b)
    expect(JSON.stringify(a.winter.opening)).toBe(opening)
    expect(returningMultiplier(a)).toBeGreaterThanOrEqual(.85)
    expect(returningMultiplier(a)).toBeLessThanOrEqual(1.15)
    const before=JSON.stringify(a.winter);settleWinter(a,a.reports.at(-1)!);expect(JSON.stringify(a.winter)).toBe(before)
  })
  it('old season game-over cannot advance beyond available weather',()=>{
    const s=newGame('scenario',91);s.day=60;openResort(s);fastForwardDay(s)
    const before=JSON.stringify(s);startNextDay(s);expect(JSON.stringify(s)).toBe(before)
  })
  it('unserved arrival demand affects the next council tourism proposal',()=>{
    const s=newGame('scenario',91)
    const before=townProposal(s,'inn').votes.find(v=>v.seat==='residents')!.score
    s.winter.days=Array.from({length:4},(_,i)=>({day:i+1,guests:200,satisfaction:70,profit:1000,cash:80000,lost:60}))
    const after=townProposal(s,'inn').votes.find(v=>v.seat==='residents')!.score
    expect(after).toBeLessThan(before)
  })
})

it('opening improvement is atomic and immediately connects starter skiing with staffed gear',async()=>{
  const {prepareOpening}=await import('./actions')
  const s=newGame('scenario',91);s.cash=100
  const before=JSON.stringify(s)
  expect(prepareOpening(s,true)).not.toBeNull();expect(JSON.stringify(s)).toBe(before)
  s.cash=80000
  expect(prepareOpening(s,true)).toBeNull()
  expect(Object.values(s.facilities)).toContain('rental-shop')
  expect(Object.values(s.facilities)).toContain('ski-school')
  expect(s.lifts['meadow-carpet'].open).toBe(true)
  const cash=s.cash
  expect(prepareOpening(s,true)).toBeNull();expect(s.cash).toBe(cash)
})
