import { it, expect } from 'vitest'
import { newGame } from './init'
import { spawnArrivals } from './guests'
import { recordVisit } from './visits'
import { Rng } from './rng'

for (const goal of ['learn','explore','challenge','relax'] as const) {
  it(`playthrough audit: ${goal} goal requires its activity and rewards exactly once`,()=>{
    const state=newGame('sandbox',42,'prairie')
    state.arrivalCarry=1;state.targetDemandToday=100
    spawnArrivals(state,new Rng(4))
    const g=Object.values(state.guests)[0]
    g.visit!.goal=goal;g.satisfaction=50
    recordVisit(state,g);expect(g.visit!.fulfilled).toBe(false)
    g.runsCompleted=4
    if(goal==='learn')g.hadLesson=true
    if(goal==='challenge')g.memories=Array.from({length:3},()=>({kind:'challenge-lap',text:'completed a challenging run',minute:600,delta:0}))
    if(goal==='relax')g.memories=[{kind:'good-meal',text:'had a great meal',minute:600,delta:8}]
    recordVisit(state,g);expect(g.visit!.fulfilled).toBe(true);expect(g.satisfaction).toBe(55)
    recordVisit(state,g);expect(g.satisfaction).toBe(55)
    expect(JSON.parse(JSON.stringify(g.visit))).toEqual(g.visit)
  })
}
