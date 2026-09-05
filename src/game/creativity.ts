import { ensureMountain } from '../content/mountain'
import type { DailyReport, GameState, HostedEventKind, ResortStyle, SeasonPostcard } from './types'
import { MOUNTAIN_MAP } from '../content/mountains'
import { hasFacility, staffCount } from './resort'
import { getTrailDef } from './trails'

export const HOSTED_EVENTS = {
  learners: { name: '🎿 First Tracks Day', cost: 1000, goal: 'Teach 6 lessons and finish with at least 65% guest satisfaction.', demand: 1.1 },
  race: { name: '🏁 Local Race Day', cost: 1500, goal: 'Record 30 laps on blue or harder runs, with no incidents.', demand: 1.15 },
  festival: { name: '🎉 Winter Festival', cost: 2500, goal: 'Welcome 100 visitors with at least 70% satisfaction.', demand: 1.2 },
} as const
export const RESORT_COLORS = ['#507066','#a95746','#497c99','#b7844e','#8f6886']
export function resortName(state: GameState) { return state.style?.name || MOUNTAIN_MAP[state.mountainId].name }
export function updateStyle(state: GameState, patch: Partial<ResortStyle>): string|null {
  if(patch.name!==undefined && patch.name.trim().length>32) return 'Use at most 32 characters for your resort name.'
  if(patch.color!==undefined && !RESORT_COLORS.includes(patch.color)) return 'Choose a resort color.'
  if(patch.decor!==undefined && !['natural','lanterns','bunting'].includes(patch.decor)) return 'Choose a decoration style.'
  state.style={...state.style,...patch,...(patch.name!==undefined?{name:patch.name.trim()}:{} )}
  return null
}
export function renameRoute(state: GameState, kind:'trail'|'lift', id:string, name:string):string|null {
  if(!(kind==='trail'?state.trails[id]?.built:state.lifts[id])) return 'Choose a built trail or lift.'
  const cleaned=name.trim()
  if(!cleaned||cleaned.length>28) return 'Use a name between 1 and 28 characters.'
  const key=kind==='trail'?'trailNames':'liftNames'
  state.style={...state.style,[key]:{...state.style[key],[id]:cleaned}}
  return null
}
export function eventReadiness(state: GameState, kind:HostedEventKind):string|null {
  ensureMountain(state.mountainId,state.mountainVersion)
  if(state.phase!=='planning'||state.gameOver) return 'Book during morning planning.'
  if(state.hostedEvents.some(e=>e.day===state.day&&e.season===state.season)) return 'One hosted event per day.'
  if(state.cash<HOSTED_EVENTS[kind].cost) return 'More cash is needed for the booking fee.'
  if(kind==='learners'&&(!hasFacility(state,'ski-school')||staffCount(state,'instructors')<1)) return 'Build a ski school and hire an instructor first.'
  if(kind==='race'&&!Object.values(state.trails).some(t=>t.built&&t.open&&getTrailDef(state,t.trailId).difficulty!=='green')) return 'Open a blue or harder run first.'
  if(kind==='festival'&&state.town.levels.mainstreet<1) return 'Complete Main Street renewal first.'
  return null
}
export function bookHostedEvent(state:GameState,kind:HostedEventKind):string|null {
  const error=eventReadiness(state,kind);if(error)return error
  const cost=HOSTED_EVENTS[kind].cost
  state.cash-=cost
  state.hostedEvents.push({kind,day:state.day,season:state.season,cost,status:'booked'})
  return null
}
export function todayHostedEvent(state:GameState){return state.hostedEvents?.find(e=>e.day===state.day&&e.season===state.season)}
export function finishHostedEvent(state:GameState,report:DailyReport):void {
  ensureMountain(state.mountainId,state.mountainVersion)
  const event=todayHostedEvent(state)
  if(!event||event.status!=='booked')return
  const lessons=state.departedToday.filter(g=>g.memories.some(m=>m.kind==='great-lesson')).length
  const laps=Object.values(state.trails).filter(t=>getTrailDef(state,t.trailId).difficulty!=='green').reduce((n,t)=>n+t.ridesToday,0)
  const won=event.kind==='learners'?lessons>=6&&report.avgSatisfaction>=65:event.kind==='race'?laps>=30&&report.incidents===0:report.guestsServed>=100&&report.avgSatisfaction>=70
  event.status=won?'success':'missed'
  event.result=event.kind==='learners'?`${lessons} lessons · ${report.avgSatisfaction}% satisfaction`:event.kind==='race'?`${laps} qualifying laps · ${report.incidents} incidents`:`${report.guestsServed} visitors · ${report.avgSatisfaction}% satisfaction`
  if(won)state.reputation=Math.min(5,state.reputation+.1)
  report.highlights.push(`${HOSTED_EVENTS[event.kind].name}: ${won?'Goal achieved (+0.1 reputation)':'Goal missed'} — ${event.result}`)
}
export function makePostcard(state:GameState):SeasonPostcard {
  return {season:state.season,day:state.day,mountainId:state.mountainId,name:resortName(state),guests:state.totalGuestsSeason,reputation:state.reputation,events:state.hostedEvents.filter(e=>e.season===state.season&&e.status==='success').length,town:structuredClone(state.town),style:structuredClone(state.style)}
}
export function keepSeasonPostcard(state:GameState) {
  if(state.postcards.some(p=>p.season===state.season&&p.day===state.day))return
  state.postcards.push(makePostcard(state));state.postcards=state.postcards.slice(-12)
}
