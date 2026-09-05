/**
 * Lift operations per tick: wind holds, mechanical faults, boarding from
 * queues at the type's hourly capacity, and delivering riders to the top.
 */
import { LIFT_TYPES, TICK_MINUTES } from '../content/balance'
import { getLiftSite, getNode } from './trails'
import { routeWindMultiplier } from './terrainModel'
import { onLiftArrival, pushAlert, remember } from './guests'
import type { Rng } from './rng'
import { runningLifts } from './resort'
import type { GameState } from './types'

export function tickLifts(state: GameState, rng: Rng): void {
  const weather = state.weatherSeason[state.day - 1]

  for (const lift of Object.values(state.lifts)) {
    const spec = LIFT_TYPES[lift.kind]
    const site = getLiftSite(state, lift.siteId)
    const windKph = weather.windKph * routeWindMultiplier([
      getNode(state, site.bottomNodeId)!.pos, getNode(state, site.topNodeId)!.pos,
    ])

    // ---- wind holds come and go with the day's wind
    if (lift.forcedClosed === 'wind') {
      if (windKph <= spec.windTolerance - 5) {
        lift.forcedClosed = null
        pushAlert(state, 'info', `${site.name} reopened after wind hold`)
      }
    } else if (lift.forcedClosed === null && lift.open && windKph > spec.windTolerance) {
      lift.forcedClosed = 'wind'
      pushAlert(state, 'warning', `${site.name} on wind hold (${Math.round(windKph)} km/h on this alignment)`)
      dumpQueue(state, lift.siteId, 'wind hold')
    }

    // ---- breakdown repair countdown
    if (lift.forcedClosed === 'breakdown') {
      lift.breakdownMinutesLeft -= TICK_MINUTES
      if (lift.breakdownMinutesLeft <= 0) {
        lift.forcedClosed = null
        pushAlert(state, 'info', `${site.name} repaired and spinning again`)
      }
    }

    // ---- riders arriving at the top (even on a stopped lift, finish the ride)
    for (let i = lift.riders.length - 1; i >= 0; i--) {
      const rider = lift.riders[i]
      if (state.minute - rider.boardedMinute >= lift.rideMinutes) {
        lift.riders.splice(i, 1)
        const guest = state.guests[rider.guestId]
        if (guest) onLiftArrival(state, guest, lift.siteId)
      }
    }
  }

  // ---- boarding, only on lifts that are actually running (staffed etc.)
  for (const lift of runningLifts(state)) {
    const spec = LIFT_TYPES[lift.kind]
    lift.boardCarry += (spec.hourlyCapacity / 60) * TICK_MINUTES
    while (lift.boardCarry >= 1 && lift.queue.length > 0) {
      lift.boardCarry -= 1
      const guestId = lift.queue.shift()!
      const guest = state.guests[guestId]
      if (!guest || guest.objective !== 'queueing') continue
      guest.objective = 'riding'
      guest.routeLiftId = lift.siteId
      lift.riders.push({ guestId, boardedMinute: state.minute })
      lift.totalRidesToday++
      // reward short waits, notice fast lifts
      if (guest.queuedMinutes < 2 && guest.runsCompleted >= 1 && rng.chance(0.12)) {
        remember(guest, 'quick-lines', 'walked straight onto the lift', +4, state.minute)
      }
      if ((lift.kind === 'high-speed-chair' || lift.kind === 'gondola') && rng.chance(0.08)) {
        remember(guest, 'fast-lift', 'loved the quick ride up', +3, state.minute)
      }
    }
    // don't bank capacity while nobody is waiting
    if (lift.queue.length === 0 && lift.boardCarry > 1) lift.boardCarry = 1
  }
}

/** roll morning mechanical faults; maintenance staff and the garage help */
export function rollBreakdowns(state: GameState, rng: Rng): void {
  const hasGarage = Object.values(state.facilities).includes('maintenance-garage')
  const mechanics = state.staff.find((d) => d.role === 'maintenance')?.headcount ?? 0
  for (const lift of Object.values(state.lifts)) {
    if (!lift.open) continue
    const spec = LIFT_TYPES[lift.kind]
    let chance = spec.faultChance
    if (hasGarage) chance *= 0.5
    chance *= Math.max(0.4, 1 - mechanics * 0.15)
    if (rng.chance(chance)) {
      lift.forcedClosed = 'breakdown'
      const repairBase = rng.range(45, 150)
      lift.breakdownMinutesLeft = Math.round(repairBase * (hasGarage ? 0.7 : 1) * Math.max(0.5, 1 - mechanics * 0.1))
      const site = getLiftSite(state, lift.siteId)
      pushAlert(state, 'critical', `${site.name} is down with a mechanical fault (~${lift.breakdownMinutesLeft} min)`)
      dumpQueue(state, lift.siteId, 'breakdown')
    }
  }
}

/** clear a queue when its lift stops; guests re-plan, some grumble */
function dumpQueue(state: GameState, siteId: string, reason: string): void {
  const lift = state.lifts[siteId]
  for (const guestId of lift.queue) {
    const guest = state.guests[guestId]
    if (!guest) continue
    remember(guest, 'breakdown', `was stuck when the lift stopped (${reason})`, -8, state.minute)
    guest.plan = []
    guest.plannedTrailId = null
    guest.objective = 'walking'
    guest.walkTarget = null
  }
  lift.queue = []
}
