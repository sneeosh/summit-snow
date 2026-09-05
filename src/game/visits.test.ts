import { describe, it, expect } from 'vitest'
import { newGame } from './init'
import { spawnArrivals } from './guests'
import { Rng } from './rng'
import { archiveVisit, ensureVisit, recordVisit, visitTrailPreference } from './visits'
import { morningBriefing } from './briefing'
import { getTrailDef } from './trails'

function fixture() {
  const state=newGame('sandbox',42,'prairie')
  state.targetDemandToday=200
  state.arrivalCarry=1
  spawnArrivals(state,new Rng(8))
  return { state, guest:Object.values(state.guests)[0] }
}
describe('guest visits',()=>{
  it('awards a completed goal once and records real activity changes',()=>{
    const {state,guest}=fixture()
    guest.visit=undefined;guest.skill='beginner'
    ensureVisit(state,guest)
    guest.hadLesson=true;guest.runsCompleted=2;guest.satisfaction=50;guest.objective='queueing'
    recordVisit(state,guest)
    expect(guest.visit!.fulfilled).toBe(true)
    expect(guest.satisfaction).toBe(55)
    const steps=guest.visit!.steps.length
    recordVisit(state,guest)
    expect(guest.satisfaction).toBe(55)
    expect(guest.visit!.steps.length).toBe(steps)
  })
  it('requires challenging runs for a challenge goal',()=>{
    const {state,guest}=fixture();guest.visit=undefined;guest.skill='expert';guest.runsCompleted=9
    recordVisit(state,guest);expect(guest.visit!.fulfilled).toBe(false)
    guest.memories=Array.from({length:3},()=>({kind:'challenge-lap',text:'run',minute:600,delta:0}))
    recordVisit(state,guest);expect(guest.visit!.fulfilled).toBe(true)
  })
  it('keeps a bounded, independent departure archive',()=>{
    const {state,guest}=fixture()
    for(let i=0;i<30;i++){guest.id=i;archiveVisit(state,guest)}
    expect(state.recentVisits).toHaveLength(24)
    guest.visit!.steps.push({minute:999,label:'later'})
    expect(state.recentVisits.at(-1)!.visit.steps.at(-1)!.label).not.toBe('later')
  })
  it('only assigns village origins when projects exist',()=>{
    const {state,guest}=fixture();guest.id=3;guest.visit=undefined
    expect(ensureVisit(state,guest).origin).toBe('day-trip')
    state.town.levels.inn=1;guest.visit=undefined
    expect(ensureVisit(state,guest).origin).toBe('inn')
    guest.id=4;guest.visit=undefined;state.town.levels.shuttle=1
    expect(ensureVisit(state,guest).origin).toBe('shuttle')
  })
  it('gives learners a preference for green terrain',()=>{
    const {state,guest}=fixture();guest.visit=undefined;guest.skill='beginner';ensureVisit(state,guest)
    const def=getTrailDef(state,Object.keys(state.trails)[0])
    expect(visitTrailPreference(guest,{...def,difficulty:'green'})).toBeGreaterThan(visitTrailPreference(guest,{...def,difficulty:'black'}))
  })
  it('briefing diagnoses a missing rental crew without mutating the game',()=>{
    const {state}=fixture();state.staff.find(d=>d.role==='rental')!.headcount=0
    const before=JSON.stringify(state)
    expect(morningBriefing(state).tips.some(t=>t.title==='Guests need rental gear')).toBe(true)
    expect(JSON.stringify(state)).toBe(before)
  })
})
