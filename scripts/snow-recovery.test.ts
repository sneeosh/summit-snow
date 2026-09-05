import { expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { MOUNTAIN_MAP } from '../src/content/mountains'
import { NODE_MAP } from '../src/content/mountain'
import { TRAIL_MIN_DEPTH_CM } from '../src/content/balance'
import { newGame } from '../src/game/init'
import { buyResort, switchResort } from '../src/game/company'
import { buildCustomLift, buildCustomTrail, buildFacility, installSnowmaking, setStaffCount, setLiftOpen, setTrailOpen } from '../src/game/actions'
import { openResort, fastForwardDay, startNextDay } from '../src/game/simulation'
import type { GameState } from '../src/game/types'

it('checks active reopening and snowmaking on the two snow-limited expansions',()=>{
 const rows:string[]=[]
 for(const id of ['alder','blanche'])for(const snowmaking of [false,true]){
  let state=newGame('sandbox',91,id==='alder'?id:'prairie')
  if(id==='blanche'){
   state.cash=MOUNTAIN_MAP[id].price+150_000
   expect(buyResort(state,id)).toBeNull()
   state=switchResort(state,id) as GameState
  }
  const start=state.cash,base={...NODE_MAP.base.pos},top={x:base.x+350,y:860}
  expect(buildFacility(state,'v3','rental-shop')).toBeNull()
  expect(setStaffCount(state,'rental',2)).toBeNull()
  expect(buildCustomLift(state,base,top,'chair')).toBeNull()
  expect(buildCustomTrail(state,[top,{x:top.x+(id==='blanche'?300:100),y:950},base])).toBeNull()
  expect(setStaffCount(state,'lift-ops',3)).toBeNull()
  expect(setStaffCount(state,'patrol',2)).toBeNull()
  if(snowmaking){
   for(const trail of Object.values(state.trails).filter(t=>t.built))expect(installSnowmaking(state,trail.trailId)).toBeNull()
   expect(setStaffCount(state,'snowmaking',2)).toBeNull()
  }
  for(const l of Object.values(state.lifts))expect(setLiftOpen(state,l.siteId,true)).toBeNull()
  const cost=start-state.cash,custom=Object.keys(state.customTrailDefs)[0]
  let closed=0,reopened=0
  for(let day=0;day<60;day++){
   for(const t of Object.values(state.trails))if(t.built&&!t.open&&t.snowDepthCm>=TRAIL_MIN_DEPTH_CM){expect(setTrailOpen(state,t.trailId,true)).toBeNull();reopened++}
   openResort(state);fastForwardDay(state)
   expect(state.gameOver).toBe(false)
   if(!state.trails[custom].open)closed++
   if(day<59)startNextDay(state)
  }
  const n=(v:number)=>Math.round(v).toLocaleString('en-US')
  rows.push(`| ${MOUNTAIN_MAP[id].name} | ${snowmaking?'Staffed snowmaking + reopen':'Reopen when snow recovers'} | ${n(cost)} | ${n(state.reports.reduce((sum,r)=>sum+r.netProfit,0))} | ${n(state.reports.reduce((sum,r)=>sum+r.avgSatisfaction,0)/60)} | ${n(state.cash)} | ${closed} | ${reopened} |`)
 }
 writeFileSync('docs/snow-recovery-playtest.md',`# Snow recovery follow-up\n\nSeed 91, 60 days per setup. Same expansions and budgets as the expansion probe. Both policies reopen built trails once snow reaches the game's opening threshold. The snowmaking policy installs guns on all three built trails and hires two snow technicians; all actions must succeed. These are four full seasons (240 operating days).\n\n| Mountain | Policy | Total build cost ($) | Operating profit ($) | Mean satisfaction | Closing cash ($) | New-run closed days | Reopening actions |\n|---|---|---:|---:|---:|---:|---:|---:|\n${rows.join('\n')}\n\nConstruction includes the rental shop, lift, return run and any snowmaking. No promotional event choices, price changes or further expansion. This is one weather seed, not a guarantee for every winter.\n`)
},120000)
