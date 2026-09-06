import {writeFileSync} from 'node:fs'
import {it,expect} from 'vitest'
import {newGame} from './init'
import {bookHostedEvent,finishHostedEvent,keepSeasonPostcard} from './creativity'
import {buyResort,switchResort} from './company'
import {openResort,fastForwardDay,startNextDay} from './simulation'
import type {GameState,DailyReport} from './types'

it('keeps bookings, fees and rewards with their resort across serialized switches',()=>{
 let g=newGame('sandbox',42,'prairie');g.cash=1e7;g.town.levels.mainstreet=3
 expect(bookHostedEvent(g,'festival')).toBeNull();expect(buyResort(g,'alder')).toBeNull()
 const cash=g.cash
 g=JSON.parse(JSON.stringify(g))
 g=switchResort(g,'alder') as GameState
 expect(g.hostedEvents).toHaveLength(0);expect(g.cash).toBe(cash)
 g=switchResort(g,'prairie') as GameState
 expect(g.hostedEvents).toHaveLength(1);expect(bookHostedEvent(g,'festival')).not.toBeNull()
 expect(g.cash).toBe(cash)
 const r={guestsServed:120,avgSatisfaction:90,incidents:0,highlights:[]} as unknown as DailyReport
 const rep=g.reputation;finishHostedEvent(g,r)
 g=JSON.parse(JSON.stringify(g));finishHostedEvent(g,r)
 expect(g.reputation).toBeCloseTo(rep+.1)
 expect(r.highlights).toHaveLength(1)
})
it('runs two full winters with bounded postcards, histories and finite finances',()=>{
 let g=newGame('sandbox',73,'prairie');g.cash=1e7
 Object.values(g.lifts).forEach(l=>l.open=true)
 for(const d of g.staff)d.headcount=4
 g.town.levels={housing:3,inn:3,mainstreet:3,shuttle:3}
 const rows=[]
 for(let day=0;day<120;day++){
  if(day%7===0)expect(bookHostedEvent(g,'festival')).toBeNull()
  openResort(g);fastForwardDay(g)
  expect(g.phase).toBe('day-end');expect(Number.isFinite(g.cash)).toBe(true)
  expect(g.recentVisits.length).toBeLessThanOrEqual(24)
  const r=g.reports.at(-1)!;rows.push({season:g.season,day:g.day,guests:r.guestsServed,satisfaction:r.avgSatisfaction,net:r.netProfit})
  if(day%10===0)g=JSON.parse(JSON.stringify(g))
  if(day<119)startNextDay(g)
 }
 expect(g.postcards).toHaveLength(2)
 expect(g.postcards[0].season).toBe(1);expect(g.postcards[1].season).toBe(2)
 const before=JSON.stringify(g.postcards);keepSeasonPostcard(g);expect(JSON.stringify(g.postcards)).toBe(before)
 if(process.env.SUMMIT_EDGE_REPORT)writeFileSync(process.env.SUMMIT_EDGE_REPORT,JSON.stringify(rows,null,2))
},120000)
