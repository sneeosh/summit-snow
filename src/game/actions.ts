/**
 * Player actions: construction, operations, staffing, pricing, financing.
 * Each returns an error string (shown in UI) or null on success, mutating
 * state only on success. Building is allowed in any phase — including while
 * paused mid-day — per the vision.
 */
import { FACILITIES, LIFT_TYPES, LOAN_OFFERS, SNOWMAKING_INSTALL_COST, TRAIL_MIN_DEPTH_CM } from '../content/balance'
import { LIFT_SITE_MAP, SLOT_MAP, TRAIL_MAP } from '../content/mountain'
import { pushAlert } from './guests'
import { makeLiftState } from './init'
import { getTrailDef, makeCustomTrailDef, planCustomTrail } from './trails'
import { computeSurface } from './weather'
import type { FacilityKind, GameState, LiftKind, Prices, StaffRole, TrailState, Vec2 } from './types'

function spend(state: GameState, amount: number): string | null {
  if (state.cash < amount) return `Not enough cash ($${Math.round(amount).toLocaleString()} needed)`
  state.cash -= amount
  return null
}

export function buildLift(state: GameState, siteId: string, kind: LiftKind): string | null {
  const site = LIFT_SITE_MAP[siteId]
  if (!site) return 'Unknown lift site'
  if (state.lifts[siteId]) return 'A lift already runs on this alignment'
  if (!site.allowedKinds.includes(kind)) return `${LIFT_TYPES[kind].label} doesn’t fit this alignment`
  const err = spend(state, LIFT_TYPES[kind].buildCost)
  if (err) return err
  state.lifts[siteId] = makeLiftState(siteId, kind)
  state.lifts[siteId].open = true
  pushAlert(state, 'info', `${site.name} built — ${LIFT_TYPES[kind].label}`)
  return null
}

export function upgradeLift(state: GameState, siteId: string, kind: LiftKind): string | null {
  const site = LIFT_SITE_MAP[siteId]
  const existing = state.lifts[siteId]
  if (!site || !existing) return 'No lift to upgrade'
  if (!site.allowedKinds.includes(kind)) return 'That lift type doesn’t fit this alignment'
  if (existing.kind === kind) return 'Already this lift type'
  // upgrade credit: half the old lift's value
  const cost = LIFT_TYPES[kind].buildCost - LIFT_TYPES[existing.kind].buildCost * 0.5
  const err = spend(state, Math.max(0, cost))
  if (err) return err
  const wasOpen = existing.open
  state.lifts[siteId] = makeLiftState(siteId, kind)
  state.lifts[siteId].open = wasOpen
  pushAlert(state, 'info', `${site.name} upgraded to ${LIFT_TYPES[kind].label}`)
  return null
}

export function setLiftOpen(state: GameState, siteId: string, open: boolean): string | null {
  const lift = state.lifts[siteId]
  if (!lift) return 'Lift not built'
  lift.open = open
  if (!open) {
    // guests in line re-plan; riders finish their ride
    for (const guestId of lift.queue) {
      const guest = state.guests[guestId]
      if (guest) {
        guest.plan = []
        guest.plannedTrailId = null
        guest.objective = 'walking'
        guest.walkTarget = null
      }
    }
    lift.queue = []
  }
  return null
}

export function buildTrail(state: GameState, trailId: string): string | null {
  const def = TRAIL_MAP[trailId]
  const trail = state.trails[trailId]
  if (!def || !trail) return 'Unknown trail'
  if (trail.built) return 'Trail already cut'
  const err = spend(state, def.buildCost)
  if (err) return err
  trail.built = true
  trail.open = trail.snowDepthCm >= TRAIL_MIN_DEPTH_CM
  pushAlert(state, 'info', `${def.name} cut and ${trail.open ? 'open' : 'awaiting snow'}`)
  return null
}

/**
 * Cut a player-drawn trail along `points`. Deliberately permissive: bad
 * lines (uphill stretches, dead ends, unreachable tops) build fine — the
 * skiers will render their verdict. Costs groundwork + tree clearing.
 */
export function buildCustomTrail(state: GameState, points: Vec2[]): string | null {
  if (points.length < 2) return 'Draw at least two points'
  const plan = planCustomTrail(state, points)
  if (plan.analysis.lengthM < 120) return 'That’s barely a slide — draw a longer line'
  const err = spend(state, plan.totalCost)
  if (err) return err

  const def = makeCustomTrailDef(state, points, plan)
  state.customTrailDefs[def.id] = def

  // starts with the same snowpack its neighbours have
  const built = Object.values(state.trails).filter((t) => t.built)
  const depth =
    built.length > 0 ? built.reduce((s, t) => s + t.snowDepthCm, 0) / built.length : 40
  const trailState: TrailState = {
    trailId: def.id,
    built: true,
    open: false,
    snowDepthCm: Math.round(depth),
    surface: 'packed-powder',
    groomedOvernight: false,
    hasSnowmaking: false,
    skierIds: [],
    ridesToday: 0,
    traffic: 0,
  }
  trailState.surface = computeSurface(trailState, state.weatherSeason[state.day - 1], (id) => getTrailDef(state, id))
  trailState.open = trailState.snowDepthCm >= TRAIL_MIN_DEPTH_CM
  state.trails[def.id] = trailState

  const treeNote = plan.treesToClear > 0 ? ` — ${plan.treesToClear} trees cleared` : ''
  pushAlert(state, 'info', `${def.name} cut${treeNote}, ${trailState.open ? 'open' : 'awaiting snow'}`)
  return null
}

export function setTrailOpen(state: GameState, trailId: string, open: boolean): string | null {
  const trail = state.trails[trailId]
  if (!trail?.built) return 'Trail not cut yet'
  if (open && trail.snowDepthCm < TRAIL_MIN_DEPTH_CM) {
    return `Not enough snow to open (${trail.snowDepthCm} cm, needs ${TRAIL_MIN_DEPTH_CM})`
  }
  trail.open = open
  return null
}

export function installSnowmaking(state: GameState, trailId: string): string | null {
  const trail = state.trails[trailId]
  if (!trail?.built) return 'Cut the trail before plumbing it'
  if (trail.hasSnowmaking) return 'Snowmaking already installed'
  const err = spend(state, SNOWMAKING_INSTALL_COST)
  if (err) return err
  trail.hasSnowmaking = true
  pushAlert(state, 'info', `Snow guns installed on ${getTrailDef(state, trailId).name}`)
  return null
}

export function buildFacility(state: GameState, slotId: string, kind: FacilityKind): string | null {
  const slot = SLOT_MAP[slotId]
  if (!slot) return 'Unknown site'
  if (state.facilities[slotId]) return 'Site already occupied'
  if (slot.allowed !== 'any-village' && !slot.allowed.includes(kind)) {
    return 'That building doesn’t suit this site'
  }
  if (slot.allowed === 'any-village' && kind === 'parking') return 'Parking goes on the lots by the entrance'
  const err = spend(state, FACILITIES[kind].buildCost)
  if (err) return err
  state.facilities[slotId] = kind
  pushAlert(state, 'info', `${FACILITIES[kind].label} opened`)
  return null
}

export function setStaffCount(state: GameState, role: StaffRole, headcount: number): string | null {
  const dept = state.staff.find((d) => d.role === role)
  if (!dept) return 'Unknown department'
  dept.headcount = Math.max(0, Math.min(40, Math.round(headcount)))
  return null
}

export function setPrices(state: GameState, patch: Partial<Prices>): string | null {
  const next = { ...state.prices, ...patch }
  next.adultTicket = clampNum(next.adultTicket, 10, 160)
  next.childTicket = clampNum(next.childTicket, 5, 120)
  next.rental = clampNum(next.rental, 5, 90)
  next.lesson = clampNum(next.lesson, 20, 200)
  next.parking = clampNum(next.parking, 0, 40)
  next.foodLevel = clampNum(Math.round(next.foodLevel), 1, 3)
  state.prices = next
  return null
}

export function takeLoan(state: GameState, offerId: string): string | null {
  const offer = LOAN_OFFERS.find((o) => o.id === offerId)
  if (!offer) return 'Unknown loan'
  if (state.loans.some((l) => l.id === offerId)) return 'This loan is already outstanding'
  state.loans.push({
    id: offer.id,
    label: offer.label,
    principal: offer.principal,
    balance: offer.principal,
    dailyRate: offer.dailyRate,
    dailyPayment: offer.dailyPayment,
  })
  state.cash += offer.principal
  pushAlert(state, 'info', `${offer.label} drawn: $${offer.principal.toLocaleString()}`)
  return null
}

function clampNum(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(v) ? v : min))
}
