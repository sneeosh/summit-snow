/** Season history and returning audiences. No RNG draws; reads actual operating outcomes. */
import { ensureMountain } from '../content/mountain'
import { WINTER, LIFT_TYPES } from '../content/balance'
import { getLiftSite, getLiftLine, getTrailDef, getTrailPath } from './trails'
import { hasFacility, staffCount, runningLifts, parkingCapacity } from './resort'
import type { GameState, DailyReport, SkillLevel, Vec2 } from './types'

export interface MountainPortrait {
  day: number; cash: number; reputation: number; facilities: number; town: number
  trails: { id: string; points: Vec2[]; difficulty: string }[]
  lifts: { id: string; points: Vec2[] }[]
}
export interface WinterRecord {
  season: number
  recoverySpendToday: number
  opening: MountainPortrait | null
  entries: { day: number; title: string; detail: string }[]
  audiences: Record<SkillLevel, number>
  admission: 'welcome' | 'comfortable'
  openingDemand: { interested: number; admitted: number; capacity: number; returning: number } | null
  days: { day: number; guests: number; satisfaction: number; profit: number; cash: number; lost: number }[]
  setback: { day: number; reason: string; kind: 'access' | 'operations'; recoveredDay: number | null } | null
}
export function newWinter(season = 1): WinterRecord {
  return { season, recoverySpendToday: 0, opening: null, entries: [], audiences: { 'first-timer': .5, beginner: .5, intermediate: .5, advanced: .5, expert: .5 }, admission: 'welcome', openingDemand: null, days: [], setback: null }
}
export function mountainPortrait(s: GameState): MountainPortrait {
  ensureMountain(s.mountainId, s.mountainVersion)
  return { day:s.day, cash:s.cash, reputation:s.reputation, facilities:Object.values(s.facilities).filter(Boolean).length,
    town:Object.values(s.town.levels).reduce((a,b)=>a+b,0),
    trails:Object.values(s.trails).filter(t=>t.built).map(t=>({id:t.trailId,points:getTrailPath(s,t.trailId).points.map(p=>({...p})),difficulty:getTrailDef(s,t.trailId).difficulty})),
    lifts:Object.values(s.lifts).map(l=>({id:l.siteId,points:getLiftLine(s,l.siteId).points.map(p=>({...p}))})) }
}
export function winterEntry(s:GameState,title:string,detail:string) {
  s.winter.entries.push({day:s.day,title,detail})
  s.winter.entries=s.winter.entries.slice(-WINTER.maxEntries)
}
export function rememberInvestment(s:GameState,before:MountainPortrait) {
  const after=mountainPortrait(s)
  const changes=[after.lifts.length-before.lifts.length,after.trails.length-before.trails.length,after.facilities-before.facilities]
  if(changes.some(n=>n>0)) winterEntry(s,'The mountain grows',`${changes.map((n,i)=>n>0?`${n} new ${['lift','run','facility'][i]}${n>1?'s':''}`:'').filter(Boolean).join(', ')}. Cash invested: $${Math.round(Math.max(0,before.cash-after.cash)).toLocaleString()}. Watch the next operating report for the result.`)
}
export function returningMultiplier(s:GameState):number {
  const values=Object.values(s.winter.audiences)
  return 1+(values.reduce((a,b)=>a+b,0)/values.length-.5)*WINTER.returnDemandStrength
}
export function audienceWeight(s:GameState,skill:SkillLevel):number {
  return 1+(s.winter.audiences[skill]-.5)*WINTER.audienceStrength
}
export function settleWinter(s:GameState,r:DailyReport) {
  const w=s.winter
  if(w.days.some(d=>d.day===s.day))return
  for(const skill of Object.keys(w.audiences) as SkillLevel[]) {
    const guests=s.departedToday.filter(g=>g.skill===skill)
    if(guests.length>=WINTER.audienceMinGuests) {
      const score=guests.reduce((n,g)=>n+g.satisfaction,0)/guests.length/100
      w.audiences[skill]=w.audiences[skill]*(1-WINTER.audienceSmoothing)+score*WINTER.audienceSmoothing
    }
  }
  w.days.push({day:s.day,guests:r.guestsServed,satisfaction:r.avgSatisfaction,profit:r.netProfit,cash:s.cash,lost:Math.max(0,(w.openingDemand?.interested??0)-(w.openingDemand?.capacity??0))})
  const accessPressure=w.days.slice(-3).filter(d=>d.lost>=WINTER.accessSetbackThreshold).length>=3
  if(!w.setback && s.day>=WINTER.setbackEarliestDay && (accessPressure || r.netProfit<0 || r.avgSatisfaction<WINTER.setbackSatisfaction)) {
    const reason=accessPressure?'Demand has exceeded arrival capacity for three operating days':r.complaints[0]?.text??(Object.values(s.trails).some(t=>t.built&&!t.open)?'Closed terrain reduced the offer':'Operating costs exceeded revenue')
    w.setback={day:s.day,reason,kind:accessPressure?'access':'operations',recoveredDay:null}
    winterEntry(s,'A difficult day',`${reason}. ${r.guestsServed} arrivals, ${r.avgSatisfaction}% satisfaction, $${r.netProfit} operating result.`)
  } else if(w.setback && !w.setback.recoveredDay && s.day>w.setback.day && r.netProfit>0 && r.avgSatisfaction>=WINTER.recoverySatisfaction && (w.setback.kind!=='access'||w.days.at(-1)!.lost===0)) {
    w.setback.recoveredDay=s.day
    winterEntry(s,'Back on our skis',`Positive operations and ${r.avgSatisfaction}% satisfaction, ${s.day-w.setback.day} days after the setback.`)
  }
  const previous=w.days.slice(0,-1)
  if(r.guestsServed>Math.max(WINTER.crowdMilestone,...previous.map(d=>d.guests))) winterEntry(s,'A new crowd record',`${r.guestsServed} arrivals; ${r.avgSatisfaction}% satisfaction. ${w.openingDemand?.capacity??0} arrival spaces available.`)
}
export function liftDiagnosis(s:GameState) {
  ensureMountain(s.mountainId,s.mountainVersion)
  const running=new Set(runningLifts(s).map(l=>l.siteId))
  return Object.values(s.lifts).map(l=>{
    const site=getLiftSite(s,l.siteId)
    const runs=Object.values(s.trails).filter(t=>t.built&&t.open&&getTrailDef(s,t.trailId).topNodeId===site.topNodeId)
    const wait=Math.ceil(l.queue.length/LIFT_TYPES[l.kind].hourlyCapacity*60)
    return {id:l.siteId,name:site.name,queue:l.queue.length,rides:l.totalRidesToday,detail:!l.open?'Closed by you':l.forcedClosed?`On ${l.forcedClosed} hold`:!running.has(l.siteId)?'Not enough lift operators':!runs.length?'No direct open return: inspect connecting routes':`${runs.length} direct open runs · ${wait} min boarding estimate. ${l.queue.length?'Demand is arriving faster than boarding.':'Guests choose reachable terrain that fits their ability.'}`}
  })
}
export function winterAdvice(s:GameState):string {
  if(!hasFacility(s,'rental-shop')||!staffCount(s,'rental'))return 'Start with staffed rentals: visitors without equipment currently turn away. Keep a cash reserve for wages.'
  if(s.winter.setback?.kind==='access'&&!s.winter.setback.recoveredDay)return `Recovery target: meet interested demand with arrival spaces, then finish profitably with ${WINTER.recoverySatisfaction}% satisfaction. Add parking or town shuttles, or use ticket prices to moderate demand. An admission limit alone does not add transport.`
  if(s.winter.setback&&!s.winter.setback.recoveredDay)return `Recovery target: a profitable day with ${WINTER.recoverySatisfaction}% satisfaction. Check closed runs, lift staffing, and the most common guest complaint before spending.`
  if(s.day>=WINTER.finaleDay)return 'Make your closing weekend count. Book First Tracks, a race, or a village festival in Events; the goal uses actual lessons, laps, and guest satisfaction.'
  if(s.winter.openingDemand && s.winter.openingDemand.interested>parkingCapacity(s))return 'Your offer has outgrown access. A shuttle adds arrival spaces; a comfortable admission limit protects breathing room but gives up ticket sales.'
  return 'Grow the offer your guests enjoy. Lessons support learners; connected steeper runs attract stronger skiers; Main Street supports a village festival.'
}
