import { HOSTED_EVENTS, todayHostedEvent } from './creativity'
/**
 * Demand modelling, day-end settlement, reputation, and the daily report.
 */
import { ACTIVE_MOUNTAIN } from '../content/mountain'
import {
  DAY_END_MIN,
  NIGHT_LIGHTS_ENERGY,
  DAY_START_MIN,
  ENERGY_COST_LIGHTS_DAILY,
  LIFT_TYPES,
  REPUTATION_SMOOTHING,
  SERIOUS_INCIDENT_REP_HIT,
  SNOWMAKING_ENERGY_PER_NIGHT,
  TICKET_REFERENCE_PRICE,
  WEEKEND_MULT,
} from '../content/balance'
import { MEMORY_COPY, renderReview, REVIEW_TEMPLATES } from '../content/names'
import { closingMinute, nightOperating } from './operations'
import { townBenefits } from './town'
import { Rng } from './rng'
import { facilityOperatingDaily, liftMaintenanceDaily, openTrailsByDifficulty, parkingCapacity } from './resort'
import type { DailyReport, ExpenseBreakdown, GameState, GuestMemory } from './types'

export function isWeekend(day: number): boolean {
  // season opens on a Saturday
  const dow = (day - 1) % 7
  return dow === 0 || dow === 1
}

/**
 * Expected visitors for the coming day. Deterministic given state — computed
 * once each morning.
 */
export function computeDailyDemand(state: GameState): number {
  const weather = state.weatherSeason[state.day - 1]
  const byDiff = openTrailsByDifficulty(state)
  const trailsOpen = byDiff.green + byDiff.blue + byDiff.black + byDiff['double-black']

  if (trailsOpen === 0) return 0

  // the local market: an interstate hill draws differently than a fjord
  const town = townBenefits(state)
  let demand = (ACTIVE_MOUNTAIN.baseDemand + town.demand) * town.demandMultiplier
  demand *= isWeekend(state.day) ? WEEKEND_MULT : 1

  // reputation: 2.5 stars ≈ neutral
  demand *= 0.55 + (state.reputation / 5) * 0.9

  // weather draw: fresh snow sells, storms and rain-warmth repel
  const yesterday = state.day > 1 ? state.weatherSeason[state.day - 2] : null
  const freshCm = weather.snowfallCm * 0.4 + (yesterday?.snowfallCm ?? 0) * 0.6
  demand *= 1 + Math.min(0.5, freshCm * 0.022)
  if (weather.windKph > 50) demand *= 0.7
  if (weather.tempHigh < -14) demand *= 0.75
  if (weather.tempHigh > 4) demand *= 0.85
  if (weather.visibility < 0.5) demand *= 0.85
  if (weather.summary === 'Bluebird') demand *= 1.15

  // price elasticity around the reference ticket
  const rel = state.prices.adultTicket / TICKET_REFERENCE_PRICE
  demand *= Math.max(0.25, Math.min(1.45, 1 - (rel - 1) * 1.1))

  // terrain variety: more open trails, more reasons to come
  demand *= Math.min(1.5, 0.55 + trailsOpen * 0.16)
  if (byDiff.blue + byDiff.black + byDiff['double-black'] === 0) demand *= 0.75 // greens-only hill

  // uphill capacity credibility: guests know when a hill is one carpet
  const capacity = runningLiftCapacityEstimate(state)
  demand *= Math.min(1.25, 0.6 + capacity / 2600)

  const hosted=todayHostedEvent(state)
  if(hosted?.status==='booked') demand *= HOSTED_EVENTS[hosted.kind].demand

  // parking ceiling
  demand = Math.min(demand, Math.max(80, parkingCapacity(state)))

  // event promotions etc.
  demand *= state.demandMultTomorrow

  return Math.round(demand)
}

function runningLiftCapacityEstimate(state: GameState): number {
  // planning-time estimate: player-opened lifts, ignoring transient holds
  return Object.values(state.lifts)
    .filter((l) => l.open)
    .reduce((sum, l) => sum + LIFT_TYPES[l.kind].hourlyCapacity, 0)
}

// -------------------------------------------------------------- settlement

export interface Settlement {
  report: DailyReport
  operatingProfit: number
}

export function settleDay(state: GameState, rng: Rng): Settlement {
  const operatedMinutes = closingMinute(state) - DAY_START_MIN

  // ---- expenses
  const payroll = state.staff.reduce((sum, d) => sum + d.headcount * d.dailyWage, 0) * (operatedMinutes / (DAY_END_MIN - DAY_START_MIN)) * (1 - townBenefits(state).payrollDiscount)
  const maintenance = liftMaintenanceDaily(state)
  const facilities = facilityOperatingDaily(state) + townBenefits(state).dailyCost

  let energy = ENERGY_COST_LIGHTS_DAILY + (nightOperating(state) ? NIGHT_LIGHTS_ENERGY : 0)
  for (const lift of Object.values(state.lifts)) {
    if (lift.open) energy += LIFT_TYPES[lift.kind].energyPerHour * (operatedMinutes / 60)
  }
  const snowmakingTrails = Object.values(state.trails).filter((t) => t.hasSnowmaking).length
  const weather = state.weatherSeason[state.day - 1]
  if (weather.tempLow <= -3 && snowmakingTrails > 0) {
    const techs = state.staff.find((d) => d.role === 'snowmaking')?.headcount ?? 0
    energy += Math.min(snowmakingTrails, techs * 2) * SNOWMAKING_ENERGY_PER_NIGHT
  }

  let interest = 0
  for (const loan of state.loans) {
    interest += loan.balance * loan.dailyRate
    const payment = Math.min(loan.balance + interest, loan.dailyPayment)
    loan.balance = Math.max(0, loan.balance + loan.balance * loan.dailyRate - payment)
    state.cash -= payment
  }
  state.loans = state.loans.filter((l) => l.balance > 1)

  const expenses: ExpenseBreakdown = {
    payroll,
    maintenance,
    energy: Math.round(energy),
    facilities,
    interest: Math.round(interest),
    hostedEvent: todayHostedEvent(state)?.cost ?? 0,
    other: (todayHostedEvent(state)?.cost ?? 0) + state.operations.controlCostToday + state.rescuesToday.reduce((sum, r) => sum + r.cost, 0),
    medevac: state.rescuesToday.reduce((sum, r) => sum + r.cost, 0),
  }
  state.cash -= payroll + maintenance + expenses.energy + facilities

  const revenue = state.revenueToday
  const revTotal = revenue.tickets + revenue.rentals + revenue.food + revenue.lessons + revenue.parking
  const expTotal = expenses.payroll + expenses.maintenance + expenses.energy + expenses.facilities + expenses.interest + expenses.other
  const operatingProfit = revTotal - expTotal

  // ---- guest verdicts
  const departed = state.departedToday
  const avgSat =
    departed.length > 0 ? departed.reduce((s, d) => s + d.satisfaction, 0) / departed.length : 0

  // ---- reputation blend
  if (departed.length > 0) {
    const dayScore = (avgSat / 100) * 5
    state.reputation =
      state.reputation * REPUTATION_SMOOTHING + dayScore * (1 - REPUTATION_SMOOTHING)
  }
  state.reputation = Math.max(0, Math.min(5, state.reputation - state.incidentsToday * SERIOUS_INCIDENT_REP_HIT))

  const report = buildReport(state, rng, avgSat, operatingProfit, expenses)

  // caretakers run the resorts you're not standing on, at half the margin
  // you managed on your last day there — an unbuilt purchase earns nothing
  let caretaker = 0
  let earning = 0
  for (const holding of state.company.holdings) {
    if (holding.mountainId === state.mountainId) continue
    const frozen = state.company.resortStates[holding.mountainId]
    const last = frozen?.reports[frozen.reports.length - 1]
    if (last && last.netProfit > 0) {
      caretaker += Math.round(last.netProfit * 0.5)
      earning++
    }
  }
  if (caretaker > 0) {
    state.cash += caretaker
    report.highlights.push(
      `Caretakers wired $${caretaker.toLocaleString()} from ${earning} other resort${earning > 1 ? 's' : ''}`,
    )
  }

  return { report, operatingProfit }
}

// ------------------------------------------------------------------ report

function buildReport(
  state: GameState,
  rng: Rng,
  avgSat: number,
  netProfit: number,
  expenses: ExpenseBreakdown,
): DailyReport {
  const departed = state.departedToday

  // tally distinct guests per memory kind (a guest griping five times is one gripe)
  const tally = new Map<string, number>()
  for (const d of departed) {
    const kinds = new Set(d.memories.map((m) => m.kind))
    for (const kind of kinds) {
      tally.set(kind, (tally.get(kind) ?? 0) + 1)
    }
  }
  const compliments: { text: string; count: number }[] = []
  const complaints: { text: string; count: number }[] = []
  for (const [kind, count] of tally) {
    const copy = MEMORY_COPY[kind]
    if (!copy) continue
    ;(copy.good ? compliments : complaints).push({ text: copy.report, count })
  }
  compliments.sort((a, b) => b.count - a.count)
  complaints.sort((a, b) => b.count - a.count)

  // a handful of individual reviews
  const reviews: DailyReport['reviews'] = []
  const pool = [...departed].sort(() => rng.next() - 0.5).slice(0, Math.min(4, departed.length))
  for (const d of pool) {
    const sat = d.satisfaction
    const template = REVIEW_TEMPLATES.find((t) => sat >= t.minSat && sat < t.maxSat) ?? REVIEW_TEMPLATES[1]
    const best = pickExtreme(d.memories, true)
    const worst = pickExtreme(d.memories, false)
    reviews.push({
      name: d.name,
      skill: d.skill,
      stars: Math.max(1, Math.min(5, Math.round(sat / 20))),
      text: renderReview(rng.pick(template.texts), best, worst, ACTIVE_MOUNTAIN.name),
    })
  }

  const highlights: string[] = []
  const weather = state.weatherSeason[state.day - 1]
  if (weather.snowfallCm >= 15) highlights.push(`${weather.snowfallCm} cm storm brought the powder crowd`)
  if (state.incidentsToday > 0) highlights.push(`${state.incidentsToday} serious incident${state.incidentsToday > 1 ? 's' : ''} on the hill`)
  if (state.peakGuestsToday > state.bestDayGuests) highlights.push('Busiest day of the season so far')
  const rides = Object.values(state.lifts).reduce((s, l) => s + l.totalRidesToday, 0)
  if (rides > 0) highlights.push(`${rides.toLocaleString()} lift rides spun today`)

  return {
    day: state.day,
    guestsServed: state.guestsArrivedToday,
    peakGuests: state.peakGuestsToday,
    avgSatisfaction: Math.round(avgSat * 10) / 10,
    revenue: { ...state.revenueToday },
    expenses,
    netProfit: Math.round(netProfit),
    compliments: compliments.slice(0, 4),
    complaints: complaints.slice(0, 4),
    reviews,
    incidents: state.incidentsToday,
    highlights,
  }
}

function pickExtreme(memories: GuestMemory[], best: boolean): GuestMemory | null {
  if (memories.length === 0) return null
  const sorted = [...memories].sort((a, b) => (best ? b.delta - a.delta : a.delta - b.delta))
  const m = sorted[0]
  if (best && m.delta <= 0) return null
  if (!best && m.delta >= 0) return null
  return m
}
