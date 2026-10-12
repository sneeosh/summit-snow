import {it,expect} from 'vitest'
import {newGame} from './init'
import {serviceCosts,settleDay} from './economy'
import {Rng} from './rng'
import {remember} from './guests'
import type {Guest} from './types'
it('scaling costs reconcile cash and the operating report without double charging',()=>{
 const s=newGame('scenario',91);s.guestsArrivedToday=100
 s.revenueToday={tickets:5000,food:1000,rentals:1000,lessons:1000,parking:300}
 const cash=s.cash,cost=serviceCosts(s)
 expect(cost).toEqual({visitorServices:1800,supplies:700})
 const {report}=settleDay(s,new Rng(s.rngState)),e=report.expenses
 expect(e.other).toBe(2500)
 expect(cash-s.cash).toBeCloseTo(e.payroll+e.maintenance+e.energy+e.facilities+e.other)
 expect(report.netProfit).toBe(Math.round(8300-(cash-s.cash)))
 s.town.levels.housing=1
 expect(serviceCosts(s).visitorServices).toBeLessThan(cost.visitorServices)
 expect(serviceCosts(s,0).visitorServices).toBe(0)
})
it('repeating one compliment cannot erase all tradeoffs or award perfect satisfaction',()=>{
 const guest={satisfaction:68,memories:[]} as unknown as Guest
 remember(guest,'groomed-run','Corduroy',6,600);const first=guest.satisfaction-68
 const before=guest.satisfaction;remember(guest,'groomed-run','Corduroy',6,610)
 expect(guest.satisfaction-before).toBeLessThan(first)
 for(let i=0;i<100;i++)remember(guest,'groomed-run','Corduroy',6,620+i)
 expect(guest.satisfaction).toBeLessThan(92)
 const happy=guest.satisfaction;remember(guest,'long-queue','Long queue',-12,730)
 expect(guest.satisfaction).toBeCloseTo(happy-12)
})
