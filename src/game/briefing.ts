import type { GameState } from './types'
import { computeDailyDemand } from './economy'
import { hasFacility, staffCount, liftStaffRequired, parkingCapacity, runningLifts, reachableNodes } from './resort'
import { townBenefits } from './town'
import { getTrailDef } from './trails'
import { forecastFor } from './weather'

export function morningBriefing(state: GameState) {
  const yesterday = state.reports.at(-1)
  const demand = state.phase === 'planning' ? computeDailyDemand(state) : state.targetDemandToday
  const tips: { title: string; detail: string; action: 'staff' | 'build' | 'pricing' | 'town' | 'operations' }[] = []
  if (!hasFacility(state, 'rental-shop') || !staffCount(state, 'rental')) tips.push({ title: 'Guests need rental gear', detail: 'A staffed rental shop keeps visitors without equipment from turning away.', action: hasFacility(state, 'rental-shop') ? 'staff' : 'build' })
  const reach = reachableNodes(state)
  if (!runningLifts(state).length) tips.push({ title: 'No lifts are running', detail: 'Open a lift and assign enough operators before welcoming skiers. Check for wind or maintenance closures.', action: 'operations' })
  else if (!Object.values(state.trails).some(t => t.built && t.open && reach.has(getTrailDef(state, t.trailId).topNodeId))) tips.push({ title: 'No accessible runs are open', detail: 'Open a run connected to a running lift so guests can ski.', action: 'operations' })
  const short = liftStaffRequired(state) - staffCount(state, 'lift-ops')
  if (short > 0) tips.push({ title: `${short} more lift operators needed`, detail: 'Some open lifts cannot run with the current crew.', action: 'staff' })
  const thin = Object.values(state.trails).filter(t => t.built && t.snowDepthCm < 20).length
  if (thin) tips.push({ title: `${thin} runs have thin cover`, detail: 'Review snowmaking and closures before guests arrive.', action: 'operations' })
  if (demand >= parkingCapacity(state) * .95) tips.push({ title: 'Arrival capacity is tight', detail: 'Parking or a village shuttle can expand access to the resort.', action: 'town' })
  if (yesterday?.complaints.length) {
    const top = [...yesterday.complaints].sort((a,b) => b.count-a.count)[0]
    tips.push({ title: 'Yesterday’s most common complaint', detail: `${top.text} · ${top.count} mentions. Review terrain access, queues and services below. Guest stories cover today’s visitors and reset each morning.`, action: 'operations' })
  }
  const forecast = forecastFor(state.weatherSeason, state.seed, state.day, Math.min(state.day + 1, state.weatherSeason.length))
  if (forecast.windKph > 40 || forecast.tempHigh > 0 || forecast.snowfallCm >= 10) tips.push({ title: 'Plan for the next forecast', detail: `${forecast.summary}: ${forecast.tempHigh}°C, wind ${forecast.windKph} km/h, ${forecast.snowfallCm} cm snow. Forecasts are estimates.`, action: 'operations' })
  if (!tips.length) tips.push({ title: 'Ready for first tracks', detail: 'Your basic services are covered. Watch guest stories after opening for opportunities to improve.', action: 'operations' })
  return { demand, yesterday, tips, benefits: townBenefits(state) }
}
