import * as a from '../src/game/actions'
import { newGame } from '../src/game/init'
import { openResort, fastForwardDay, startNextDay, tick } from '../src/game/simulation'
import { bookHostedEvent } from '../src/game/creativity'
import { mountainPortrait, rememberInvestment } from '../src/game/winter'
import { TRAIL_MIN_DEPTH_CM } from '../src/content/balance'
import type { GameState } from '../src/game/types'
export type Strategy='learners'|'terrain'|'village'
export function prepareStrategy(seed:number,strategy:Strategy) {
 const s=newGame('scenario',seed)
 s.tutorialActive=false
 const before=mountainPortrait(s)
 a.setLiftOpen(s,'meadow-carpet',true)
 a.buildFacility(s,'v3','rental-shop');a.setStaffCount(s,'rental',2)
 a.setPrices(s,{adultTicket:45,childTicket:30})
 if(strategy==='learners'){a.buildFacility(s,'v4','ski-school');a.setStaffCount(s,'instructors',2)}
 if(strategy==='village')a.proposeTownProject(s,'mainstreet',false)
 if(strategy==='terrain'){a.takeLoan(s,'expansion');a.buildLift(s,'alder-chair','chair');a.buildTrail(s,'alder-run');a.setStaffCount(s,'lift-ops',3)}
 a.installSnowmaking(s,'bunny-hollow');a.setStaffCount(s,'snowmaking',1)
 rememberInvestment(s,before)
 return s
}
export function planStrategyDay(s:GameState,strategy:Strategy) {
 const before=mountainPortrait(s)
 if(strategy!=='village'&&s.winter.days.slice(-3).filter(d=>d.lost>=20).length>=3&&s.cash>25000){
   const slot=['p2','p3','p4'].find(id=>!s.facilities[id]);if(slot)a.buildFacility(s,slot,'parking')
 }
 if(s.day===8&&s.cash>30000){a.buildFacility(s,'v5','cafe');a.setStaffCount(s,'food-service',2)}
 if(s.day>=12&&!s.lifts['alder-chair']&&s.cash>100000){a.buildLift(s,'alder-chair','chair');a.buildTrail(s,'alder-run');a.setStaffCount(s,'lift-ops',3)}
 if(strategy==='terrain'&&s.cash>110000&&!s.lifts['timber-chair']){a.buildLift(s,'timber-chair','chair');a.buildTrail(s,'timberline');a.setStaffCount(s,'lift-ops',5);a.setStaffCount(s,'patrol',3)}
 if(strategy==='village'&&!s.town.construction){
  if(!s.town.levels.shuttle&&s.cash>45000)a.proposeTownProject(s,'shuttle',false)
  else if(!s.town.levels.housing&&s.cash>60000)a.proposeTownProject(s,'housing',false)
  else if(!s.town.levels.inn&&s.cash>100000)a.proposeTownProject(s,'inn',false)
 }
 for(const t of Object.values(s.trails).filter(t=>t.built)){
  if(!t.hasSnowmaking&&s.cash>35000){a.installSnowmaking(s,t.trailId);a.setStaffCount(s,'snowmaking',Math.ceil(Object.values(s.trails).filter(t=>t.hasSnowmaking).length/2))}
  if(t.snowDepthCm<TRAIL_MIN_DEPTH_CM&&s.cash>12000)a.restoreThinRun(s,t.trailId)
  a.setTrailOpen(s,t.trailId,true)
 }
 if(s.day===54)bookHostedEvent(s,strategy==='terrain'?'race':strategy==='village'?'festival':'learners')
 rememberInvestment(s,before)
}
export function scenario(seed:number,strategy:Strategy,day:number,busy=false) {
 const s=prepareStrategy(seed,strategy)
 while(s.day<day&&!s.gameOver){planStrategyDay(s,strategy);openResort(s);fastForwardDay(s);if(!s.gameOver)startNextDay(s)}
 if(busy&&!s.gameOver){planStrategyDay(s,strategy);openResort(s);while(s.phase==='operating'&&s.minute<660)tick(s)}
 return s
}
