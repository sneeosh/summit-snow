/** Full-season paired operations: npm run playtest:expansion. */
import { expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { MOUNTAINS } from '../src/content/mountains'
import { NODE_MAP } from '../src/content/mountain'
import { STARTING_CASH_SANDBOX } from '../src/content/balance'
import { newGame } from '../src/game/init'
import { buyResort, switchResort } from '../src/game/company'
import { buildCustomLift, buildCustomTrail, buildFacility, setStaffCount, setLiftOpen } from '../src/game/actions'
import { hillGoals } from '../src/game/hillGoals'
import { openResort, fastForwardDay, startNextDay } from '../src/game/simulation'
import type { GameState } from '../src/game/types'

const rows: string[] = []
for(const mountain of MOUNTAINS) {
 it(`operates and compares a new chair and return run on ${mountain.name}`,()=>{
  const cases:{expanded:boolean;profit:number;satisfaction:number;cash:number;cost:number;rides:number;closed:number;grade:string}[]=[]
  for(const seed of [91]) for(const expanded of [false,true]) {
   let state = newGame('sandbox',seed,mountain.price<=STARTING_CASH_SANDBOX?mountain.id:'prairie')
   if(mountain.price>STARTING_CASH_SANDBOX) {
    state.cash=mountain.price+150_000
    expect(buyResort(state,mountain.id)).toBeNull()
    state=switchResort(state,mountain.id) as GameState
    expect(state.cash).toBe(150_000)
   }
   expect(buildFacility(state,'v3','rental-shop')).toBeNull()
   expect(setStaffCount(state,'rental',2)).toBeNull()
   let cost=0,customId='',grade='—'
   if(expanded) {
    const before=state.cash,base={...NODE_MAP.base.pos}
    const top={x:Math.min(1700,base.x+350),y:mountain.id==='prairie'?780:860}
    const bend={x:top.x+(mountain.id==='blanche'?300:100),y:(top.y+1040)/2}
    expect(buildCustomLift(state,base,top,'chair')).toBeNull()
    expect(buildCustomTrail(state,[top,bend,base])).toBeNull()
    expect(setStaffCount(state,'lift-ops',3)).toBeNull()
    expect(setStaffCount(state,'patrol',2)).toBeNull()
    cost=before-state.cash
    const trail=Object.values(state.customTrailDefs)[0]
    customId=trail.id; grade=trail.difficulty
    expect(trail.totalClimbM??0).toBeLessThanOrEqual(2)
    expect(grade).toBe(mountain.id==='prairie'?'green':'blue')
   }
   for(const lift of Object.values(state.lifts)) expect(setLiftOpen(state,lift.siteId,true)).toBeNull()
   if(expanded && ['granite','alder','elk','kea'].includes(mountain.id)) expect(hillGoals(state).find(g=>g.id==='blue')!.progress).toBeGreaterThan(0)
   let rides=0,closed=0
   for(let day=0;day<60;day++) {
    openResort(state);fastForwardDay(state)
    expect(state.phase).toBe('day-end')
    expect(Number.isFinite(state.cash)).toBe(true)
    expect(state.gameOver).toBe(false)
    if(customId) {rides+=state.trails[customId].ridesToday;if(!state.trails[customId].open)closed++}
    if(day<59)startNextDay(state)
   }
   if(expanded)expect(rides).toBeGreaterThan(0)
   cases.push({expanded,cost,grade,rides,closed,cash:state.cash,profit:state.reports.reduce((sum,r)=>sum+r.netProfit,0),satisfaction:state.reports.reduce((sum,r)=>sum+r.avgSatisfaction,0)/60})
   startNextDay(state)
   expect(state.season).toBe(2)
   expect(state.day).toBe(1)
  }
  const range=(ns:number[])=>Math.round(ns[0]).toLocaleString('en-US')
  for(const expanded of [false,true]){
   const group=cases.filter(c=>c.expanded===expanded)
   rows.push(`| ${mountain.name} | ${expanded?'New chair + '+group[0].grade:'Rental baseline'} | ${range(group.map(c=>c.cost))} | ${range(group.map(c=>c.profit))} | ${range(group.map(c=>c.satisfaction))} | ${range(group.map(c=>c.cash))} | ${range(group.map(c=>c.rides))} | ${expanded?range(group.map(c=>c.closed)):'—'} |`)
  }
  if(process.env.SUMMIT_EXPANSION_REPORT==='1')writeFileSync('docs/expansion-playtest.md',`# Full-season expansion playtest\n\nSeed 91, paired 60-day seasons on all eight hills: 960 operating days. The separate first-week probe covers three seeds. Both setups have staffed rentals. Expansion adds one chair, a downhill return run, three lift operators and two patrollers. All build actions must succeed; the new run must receive riders. Starting resorts retain the normal purchase budget. Later resorts are bought with a controlled $150,000 left after acquisition, not simulated earnings. No further purchases, snowmaking, manual reopening after a snow closure, or price changes are made.\n\n| Mountain | Setup | Expansion cost ($) | Operating profit ($) | Mean satisfaction | Closing cash ($) | New-run rides | New-run closed days |\n|---|---|---:|---:|---:|---:|---:|---:|\n${rows.join('\n')}\n\nEach value is from seed 91. Operating profit excludes construction; closing cash includes it. This is an operating-policy comparison, not an optimal strategy or a test of earning the purchase price. Closed days include snow closures that remain closed until a player reopens them; they are not all days of insufficient snow. See the snow-recovery follow-up for active management.\n`)
 },60000)
}
