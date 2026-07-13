/** Derived, resort-level queries shared by sim systems and UI. Pure reads. */
import {
  FACILITIES,
  GUESTS_PER_PARKING,
  LIFT_TYPES,
  PUMP_STATION_MULT,
  RENTAL_GUESTS_PER_STAFF_HOUR,
  TRAILS_PER_GROOMER,
  TRAILS_PER_PATROLLER,
  TRAILS_PER_SNOW_TECH,
} from '../content/balance'
import { allNodes, getLiftSite, getTrailDef } from './trails'
import type { FacilityKind, GameState, LiftState, StaffRole, TrailState } from './types'

export function countFacility(state: GameState, kind: FacilityKind): number {
  return Object.values(state.facilities).filter((f) => f === kind).length
}

export function hasFacility(state: GameState, kind: FacilityKind): boolean {
  return countFacility(state, kind) > 0
}

export function staffCount(state: GameState, role: StaffRole): number {
  return state.staff.find((d) => d.role === role)?.headcount ?? 0
}

/** lift-ops seats needed to run every player-opened lift */
export function liftStaffRequired(state: GameState): number {
  return Object.values(state.lifts)
    .filter((l) => l.open)
    .reduce((sum, l) => sum + LIFT_TYPES[l.kind].staffRequired, 0)
}

/**
 * Lifts actually running right now: player-opened, not wind/breakdown closed,
 * and staffed (lift-ops are allocated in site order until they run out).
 */
export function runningLifts(state: GameState): LiftState[] {
  let opsLeft = staffCount(state, 'lift-ops')
  const running: LiftState[] = []
  for (const lift of Object.values(state.lifts)) {
    if (!lift.open || lift.forcedClosed) continue
    const need = LIFT_TYPES[lift.kind].staffRequired
    if (opsLeft >= need) {
      opsLeft -= need
      running.push(lift)
    }
  }
  return running
}

export function isLiftRunning(state: GameState, siteId: string): boolean {
  return runningLifts(state).some((l) => l.siteId === siteId)
}

export function openTrails(state: GameState): TrailState[] {
  return Object.values(state.trails).filter((t) => t.built && t.open)
}

export function patrolCoverage(state: GameState): number {
  const open = openTrails(state).length
  if (open === 0) return 1
  const patrollers = staffCount(state, 'patrol')
  const hqBoost = hasFacility(state, 'patrol-hq') ? 1.4 : 1
  return Math.min(1.5, (patrollers * TRAILS_PER_PATROLLER * hqBoost) / open)
}

export function rentalCapacityPerHour(state: GameState): number {
  if (!hasFacility(state, 'rental-shop')) return 0
  return staffCount(state, 'rental') * RENTAL_GUESTS_PER_STAFF_HOUR
}

export function groomerCapacity(state: GameState): number {
  return staffCount(state, 'grooming') * TRAILS_PER_GROOMER
}

export function snowmakingCapacity(state: GameState): number {
  return staffCount(state, 'snowmaking') * TRAILS_PER_SNOW_TECH
}

export function snowmakingBoost(state: GameState): number {
  return hasFacility(state, 'pump-station') ? PUMP_STATION_MULT : 1
}

export function parkingCapacity(state: GameState): number {
  return countFacility(state, 'parking') * GUESTS_PER_PARKING
}

/** seats across food venues, gated by food-service staffing */
export function foodCapacity(state: GameState): number {
  const cafeSeats = countFacility(state, 'cafe') * FACILITIES.cafe.capacity
  const restSeats = countFacility(state, 'restaurant') * FACILITIES.restaurant.capacity
  const lodgeSnack = countFacility(state, 'base-lodge') * 10 // lodge has a small snack counter
  const staffed = staffCount(state, 'food-service') * 12
  return Math.min(cafeSeats + restSeats + lodgeSnack, staffed)
}

export function facilityOperatingDaily(state: GameState): number {
  return Object.values(state.facilities)
    .filter((f): f is FacilityKind => f !== null)
    .reduce((sum, kind) => sum + FACILITIES[kind].operatingDaily, 0)
}

export function liftMaintenanceDaily(state: GameState): number {
  return Object.values(state.lifts).reduce((sum, l) => sum + LIFT_TYPES[l.kind].maintenanceDaily, 0)
}

/** count of open trails by difficulty, for demand & guest terrain matching */
export function openTrailsByDifficulty(state: GameState): Record<string, number> {
  const counts: Record<string, number> = { green: 0, blue: 0, black: 0, 'double-black': 0 }
  for (const t of openTrails(state)) counts[getTrailDef(state, t.trailId).difficulty]++
  return counts
}

/** true when the trail's top is reachable via currently running lifts from a base */
export function trailReachable(state: GameState, trailId: string): boolean {
  return reachableNodes(state).has(getTrailDef(state, trailId).topNodeId)
}

/** nodes reachable uphill from base areas via running lifts */
export function reachableNodes(state: GameState): Set<string> {
  const running = runningLifts(state)
  // every base-area station is walk-to-able, including custom lift terminals
  const reach = new Set<string>(allNodes(state).filter((n) => n.isBase).map((n) => n.id))
  let grew = true
  while (grew) {
    grew = false
    for (const lift of running) {
      const site = getLiftSite(state, lift.siteId)
      if (reach.has(site.bottomNodeId) && !reach.has(site.topNodeId)) {
        reach.add(site.topNodeId)
        grew = true
      }
    }
  }
  return reach
}
