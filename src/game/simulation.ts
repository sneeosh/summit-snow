/**
 * Simulation orchestrator: the tick pipeline and the day lifecycle
 * (planning → operating → day-end → next morning). Pure state-in/state-out;
 * the Zustand store owns scheduling and immutability boundaries.
 */
import { DAY_END_MIN, DAY_START_MIN, SEASON_DAYS, TICK_MINUTES } from '../content/balance'
import { computeDailyDemand, settleDay } from './economy'
import { createEventProvider, expireOldEvents, type EventContext } from './events'
import { pushAlert, spawnArrivals, tickGuests } from './guests'
import { rollBreakdowns, tickLifts } from './lifts'
import { updateObjectives } from './objectives'
import { groomerCapacity, hasFacility, openTrails, snowmakingBoost, snowmakingCapacity } from './resort'
import { Rng } from './rng'
import { processOvernight } from './weather'
import type { GameState } from './types'

const eventProvider = createEventProvider({ provider: 'local' })

/** ends planning, computes the day's demand, rolls morning faults & events */
export function openResort(state: GameState): void {
  if (state.phase !== 'planning') return
  const rng = new Rng(state.rngState)

  state.phase = 'operating'
  state.minute = DAY_START_MIN
  state.targetDemandToday = computeDailyDemand(state)
  state.demandMultTomorrow = 1

  rollBreakdowns(state, rng)

  const weather = state.weatherSeason[state.day - 1]
  if (weather.snowfallCm >= 15) pushAlert(state, 'info', `Powder day — ${weather.snowfallCm} cm fresh overnight`)
  if (weather.windKph > 45) pushAlert(state, 'warning', 'High winds today — exposed lifts may go on hold')
  if (state.targetDemandToday > 350) pushAlert(state, 'info', 'Big crowd expected today — watch the lift lines')
  if (state.targetDemandToday < 60) pushAlert(state, 'warning', 'Quiet day expected — thin crowds forecast')

  state.rngState = rng.state
}

/** one fixed-step sim tick while operating */
export function tick(state: GameState): void {
  if (state.phase !== 'operating') return
  const rng = new Rng(state.rngState)

  state.minute += TICK_MINUTES

  spawnArrivals(state, rng)
  tickLifts(state, rng)
  tickGuests(state, rng)

  // day winds down: everyone still on the hill heads out; hard cutoff later
  if (state.minute >= DAY_END_MIN) {
    const remaining = Object.values(state.guests)
    if (remaining.length === 0 || state.minute >= DAY_END_MIN + 75) {
      for (const g of remaining) {
        state.departedToday.push({
          satisfaction: g.satisfaction,
          name: g.name,
          skill: g.skill,
          memories: g.memories,
          spent: g.spent,
        })
        delete state.guests[g.id]
      }
      endDay(state, rng)
    }
  }

  state.rngState = rng.state
}

/** skip the rest of the operating day at full sim speed (End Day button) */
export function fastForwardDay(state: GameState): void {
  let safety = 20_000
  while (state.phase === 'operating' && safety-- > 0) {
    tick(state)
  }
}

function endDay(state: GameState, rng: Rng): void {
  state.phase = 'day-end'

  const { report } = settleDay(state, rng)
  state.reports.push(report)
  if (state.reports.length > SEASON_DAYS) state.reports.splice(0, state.reports.length - SEASON_DAYS)

  state.seasonIncidents += state.incidentsToday
  state.bestDayGuests = Math.max(state.bestDayGuests, report.guestsServed)
  updateObjectives(state, report, state.seasonIncidents)

  // bankruptcy: a small overdraft is tolerated, a hole is not
  if (state.mode === 'scenario' && state.cash < -10_000) {
    state.gameOver = true
    pushAlert(state, 'critical', 'The bank has called the loan. The mountain is theirs now.')
  }
  if (state.day >= SEASON_DAYS) {
    state.gameOver = true
  }
}

/** advance from the day-end report into the next planning morning */
export function startNextDay(state: GameState): void {
  if (state.phase !== 'day-end') return

  state.day += 1
  state.minute = DAY_START_MIN
  state.phase = 'planning'

  // ---- overnight mountain work (uses the dawning day's weather)
  const weather = state.weatherSeason[state.day - 1]
  processOvernight(state.trails, weather, {
    groomerCapacity: groomerCapacity(state),
    snowmakingCapacity: snowmakingCapacity(state),
    snowmakingBoost: snowmakingBoost(state),
    snowBonusCm: state.snowBonusCm,
  })
  state.snowBonusCm = 0

  // ---- reset daily accumulators
  state.departedToday = []
  state.guestsArrivedToday = 0
  state.peakGuestsToday = 0
  state.revenueToday = { tickets: 0, rentals: 0, food: 0, lessons: 0, parking: 0 }
  state.incidentsToday = 0
  state.arrivalCarry = 0
  for (const lift of Object.values(state.lifts)) {
    lift.queue = []
    lift.riders = []
    lift.boardCarry = 0
    lift.totalRidesToday = 0
    if (lift.forcedClosed === 'wind') lift.forcedClosed = null
  }
  for (const trail of Object.values(state.trails)) {
    trail.skierIds = []
    trail.ridesToday = 0
  }

  // ---- morning events
  expireOldEvents(state)
  const yesterday = state.reports[state.reports.length - 1]
  const ctx: EventContext = {
    day: state.day,
    seed: state.seed,
    reputation: state.reputation,
    cash: state.cash,
    incidentsYesterday: yesterday?.incidents ?? 0,
    weatherSummary: weather.summary,
    snowfallCm: weather.snowfallCm,
    openTrailCount: openTrails(state).length,
    hasRestaurant: hasFacility(state, 'restaurant'),
    staffMorale: state.staffMorale,
  }
  state.events.push(...eventProvider.generate(ctx))

  // morale drifts back toward neutral
  state.staffMorale = Math.max(0, Math.min(1, state.staffMorale * 0.92 + 0.75 * 0.08))
}
