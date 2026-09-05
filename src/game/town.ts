import { TOWN_COUNCIL_RULES as COUNCIL, TOWN_BEDS_PER_INN, TOWN_COMPACT_PAYROLL_DISCOUNT, TOWN_DEMAND_PER_INN, TOWN_HOMES_COMPACT_COST, TOWN_HOUSING_PAYROLL_DISCOUNT, TOWN_MAX_LEVEL, TOWN_MAX_PAYROLL_DISCOUNT, TOWN_SERVICE_COSTS, TOWN_SHUTTLE_CAPACITY, TOWN_STREET_DEMAND_MULT, TOWN_VOTE_THRESHOLD } from '../content/balance'
import { TOWN_PROJECTS, TOWN_REGION_PRESSURE, TOWN_SEATS } from '../content/town'
import { TOWN_POLICY_COSTS, TOWN_MARKET_DEMAND, TOWN_MARKET_DAILY_COST, TOWN_DARK_SKY_SAVING } from '../content/balance'
import { TOWN_POLICIES } from '../content/town'
import type { GameState, TownProject, TownState, TownPolicy } from './types'

export function newTown(): TownState {
 const town: TownState = { policies: { winterMarket: false, darkSky: false }, scrapbook: [], levels: { inn: 0, housing: 0, shuttle: 0, mainstreet: 0 }, trust: { residents: 50, businesses: 50, conservation: 50 }, compactHomes: 0, construction: null, lastOpening: null }
 town.scrapbook.push(townMemory(town, 1, 1, 'Our first winter'))
 return town
}
export function townBenefits(state: GameState) {
 const town = state.town, l = town.levels
 return { beds: l.inn * TOWN_BEDS_PER_INN, demand: l.inn * TOWN_DEMAND_PER_INN,
  transport: l.shuttle * TOWN_SHUTTLE_CAPACITY,
  payrollDiscount: Math.min(TOWN_MAX_PAYROLL_DISCOUNT, l.housing * TOWN_HOUSING_PAYROLL_DISCOUNT + town.compactHomes * TOWN_COMPACT_PAYROLL_DISCOUNT),
  demandMultiplier: 1 + l.mainstreet * TOWN_STREET_DEMAND_MULT + (town.policies.winterMarket ? TOWN_MARKET_DEMAND : 0),
  dailyCost: (Object.entries(l).reduce((sum,[key,level])=>sum+level*TOWN_SERVICE_COSTS[key as TownProject],0) + (town.policies.winterMarket ? TOWN_MARKET_DAILY_COST : 0)) * (town.policies.darkSky ? 1 - TOWN_DARK_SKY_SAVING : 1) }
}
export function townProposal(state: GameState, project: TownProject, homes = false) {
 const spec = TOWN_PROJECTS[project], level = state.town.levels[project]
 const compact = project === 'inn' && homes
 const pressure = TOWN_REGION_PRESSURE[state.mountainId] ?? 0
 const votes = TOWN_SEATS.map(seat=>{
  let score = state.town.trust[seat] + spec.votes[seat]
  if (project === 'inn') {
   if (seat === 'residents') score += state.town.levels.housing * COUNCIL.housingSupport + state.town.levels.mainstreet * COUNCIL.streetSupport + (compact ? COUNCIL.compactSupport : 0) - pressure
   if (seat === 'conservation') score += state.town.levels.shuttle * COUNCIL.shuttleSupport + state.town.levels.mainstreet * COUNCIL.streetSupport - pressure
   if (seat === 'businesses' && compact) score -= COUNCIL.compactBusinessCost
  }
  return { seat, score: Math.max(0,Math.min(100,score)), yes: score >= TOWN_VOTE_THRESHOLD }
 })
 return { cost: spec.cost * (level + 1) + (compact ? TOWN_HOMES_COMPACT_COST : 0), days: spec.days + level,
  votes, approved: votes.filter(v=>v.yes).length >= 2, maxed: level >= TOWN_MAX_LEVEL }
}
/** Construction advances once per completed operating day, never from real time. */
export function advanceTown(state: GameState): string | null {
 const build = state.town.construction
 if (!build) return null
 build.remainingDays--
 if (build.remainingDays > 0) return null
 const level = ++state.town.levels[build.project]
 if (build.homes) state.town.compactHomes++
 for (const seat of TOWN_SEATS) {
  const delta = TOWN_PROJECTS[build.project].trust[seat] + (build.homes && seat === 'residents' ? COUNCIL.compactTrust : 0)
  state.town.trust[seat] = Math.max(COUNCIL.trustMin,Math.min(COUNCIL.trustMax,state.town.trust[seat]+delta))
 }
 state.town.lastOpening = { project: build.project, level, day: state.day, season: state.season }
 state.town.scrapbook.push(townMemory(state.town, state.day, state.season, `${TOWN_PROJECTS[build.project].name} · Level ${level}`))
 state.town.construction = null
 return `${TOWN_PROJECTS[build.project].name} level ${level} opens today — take a look around town!`
}
export function townStage(state: GameState): string {
 const total = Object.values(state.town.levels).reduce((a,b)=>a+b,0)
 return total >= 10 ? 'Alpine destination' : total >= 6 ? 'Thriving ski town' : total >= 2 ? 'Growing village' : 'Mountain hamlet'
}

export function townMemory(town: TownState, day: number, season: number, label: string) {
 return { label, day, season, levels: { ...town.levels }, compactHomes: town.compactHomes, policies: { ...town.policies } }
}
export function townPolicyProposal(state: GameState, policy: TownPolicy) {
 const votes = TOWN_SEATS.map(seat => ({ seat, yes: state.town.trust[seat] + TOWN_POLICIES[policy].votes[seat] >= TOWN_VOTE_THRESHOLD }))
 return { votes, approved: votes.filter(v => v.yes).length >= 2, cost: TOWN_POLICY_COSTS[policy] }
}
