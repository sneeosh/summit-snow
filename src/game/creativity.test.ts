import { describe,it,expect } from 'vitest'
import { newGame } from './init'
import { bookHostedEvent,finishHostedEvent,keepSeasonPostcard,renameRoute,updateStyle } from './creativity'
import { openResort,fastForwardDay,startNextDay } from './simulation'
import { getTrailDef,allTrailDefs } from './trails'
import type { DailyReport } from './types'

describe('creative resort preview',()=>{
  it('books once, charges once, and includes the fee in the operating report',()=>{
    const g=newGame('sandbox',42,'prairie');g.town.levels.mainstreet=1
    const before=g.cash
    expect(bookHostedEvent(g,'festival')).toBeNull();expect(g.cash).toBe(before-2500)
    expect(bookHostedEvent(g,'festival')).not.toBeNull();expect(g.cash).toBe(before-2500)
    openResort(g);fastForwardDay(g)
    expect(g.reports.at(-1)!.expenses.hostedEvent).toBe(2500)
    expect(g.reports.at(-1)!.highlights.some(h=>h.includes('Winter Festival'))).toBe(true)
    expect(g.hostedEvents[0].status).not.toBe('booked')
    startNextDay(g);openResort(g);fastForwardDay(g)
    expect(g.reports.at(-1)!.expenses.hostedEvent).toBe(0)
  })
  it('rejects an event without facilities, cash, or morning planning',()=>{
    const g=newGame('sandbox',42,'prairie')
    expect(bookHostedEvent(g,'learners')).not.toBeNull()
    g.town.levels.mainstreet=1;g.cash=0;expect(bookHostedEvent(g,'festival')).not.toBeNull()
    g.cash=10000;g.phase='operating';expect(bookHostedEvent(g,'festival')).not.toBeNull()
    expect(g.hostedEvents).toHaveLength(0)
  })
  it('resolves a successful festival only once',()=>{
    const g=newGame('sandbox',42,'prairie');g.town.levels.mainstreet=1;bookHostedEvent(g,'festival')
    const report={guestsServed:100,avgSatisfaction:75,incidents:0,highlights:[]} as unknown as DailyReport
    const rep=g.reputation;finishHostedEvent(g,report);finishHostedEvent(g,report)
    expect(g.reputation).toBeCloseTo(rep+.1);expect(report.highlights).toHaveLength(1)
  })
  it('renames routes without changing shared authored content',()=>{
    const g=newGame('sandbox',42,'prairie'),id=Object.keys(g.trails).find(id=>g.trails[id].built)!
    const original=getTrailDef(g,id).name
    expect(renameRoute(g,'trail',id,'Kenny’s Run')).toBeNull()
    expect(getTrailDef(g,id).name).toBe('Kenny’s Run')
    expect(allTrailDefs(g).find(t=>t.id===id)!.name).toBe('Kenny’s Run')
    const other=newGame('sandbox',42,'prairie');expect(getTrailDef(other,id).name).toBe(original)
    expect(renameRoute(g,'trail',id,'')).not.toBeNull()
    expect(updateStyle(g,{color:'invalid'})).not.toBeNull()
  })
  it('freezes season postcards and does not duplicate them',()=>{
    const g=newGame('sandbox',42,'prairie');g.day=60;g.style.name='Snow & Co';g.town.levels.housing=2
    keepSeasonPostcard(g);keepSeasonPostcard(g);g.town.levels.housing=3;g.style.name='Changed'
    expect(g.postcards).toHaveLength(1);expect(g.postcards[0].name).toBe('Snow & Co');expect(g.postcards[0].town.levels.housing).toBe(2)
    expect(JSON.parse(JSON.stringify(g))).toEqual(g)
  })
})
