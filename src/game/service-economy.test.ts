import {it,expect} from 'vitest'
import {newGame} from './init'
import {serviceCosts,settleDay} from './economy'
import {liftMaintenanceDaily} from './resort'
import {CROWD_STAFFING,LIFT_WEAR_PER_RIDE} from '../content/balance'
import {Rng} from './rng'
import {remember} from './guests'
import type {Guest} from './types'
it('scaling costs reconcile cash and the operating report without double charging',()=>{
 const s=newGame('scenario',91);s.guestsArrivedToday=100
 s.revenueToday={tickets:5000,food:1000,rentals:1000,lessons:1000,parking:300}
 const crew=CROWD_STAFFING.roles.reduce((n,r)=>n+(s.staff.find(d=>d.role===r)?.headcount??0),0)
 const cash=s.cash,cost=serviceCosts(s)
 expect(cost.supplies).toBe(700)
 expect(cost.crowdStaffing).toBeGreaterThan(0)
 expect(serviceCosts(s,crew*CROWD_STAFFING.guestsPerStaff).crowdStaffing).toBe(0)
 const idle=liftMaintenanceDaily(s),lift=Object.values(s.lifts)[0];lift.totalRidesToday=100
 expect(liftMaintenanceDaily(s)).toBeCloseTo(idle+100*LIFT_WEAR_PER_RIDE)
 const {report}=settleDay(s,new Rng(s.rngState)),e=report.expenses
 expect(e.other).toBe(700)
 expect(e.crowdStaffing).toBe(cost.crowdStaffing)
 expect(e.payroll).toBeGreaterThanOrEqual(cost.crowdStaffing)
 expect(cash-s.cash).toBeCloseTo(e.payroll+e.maintenance+e.energy+e.facilities+e.other)
 expect(report.netProfit).toBe(Math.round(8300-(cash-s.cash)))
 s.town.levels.housing=1
 expect(serviceCosts(s).crowdStaffing).toBeLessThan(cost.crowdStaffing)
 s.staff.find(d=>d.role==='lift-ops')!.headcount+=4
 expect(serviceCosts(s).crowdStaffing).toBeLessThan(cost.crowdStaffing)
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
