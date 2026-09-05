/**
 * Player actions: construction, operations, staffing, pricing, financing.
 * Each returns an error string (shown in UI) or null on success, mutating
 * state only on success. Building is allowed in any phase — including while
 * paused mid-day — per the vision.
 */
import {
  NIGHT_LIGHTING_COST,
  AVALANCHE_CONTROL_STAFF,
  AVALANCHE_CONTROL_COST_PER_RUN,
  FACILITIES,
  LIFT_BASE_COST,
  LIFT_COST_PER_M,
  LIFT_MIN_RISE_M,
  LIFT_TYPES,
  LOAN_OFFERS,
  SNOWMAKING_INSTALL_COST,
  TRAIL_MIN_DEPTH_CM,
} from '../content/balance'
import { LIFT_SITE_MAP, SLOT_MAP, TRAIL_MAP } from '../content/mountain'
import { CUSTOM_LIFT_NAMES } from '../content/names'
import { pushAlert } from './guests'
import { makeLiftState } from './init'
import { ensureJunction, registerTrailJunctions } from './junctions'
import {
  ensureNode,
  getLiftSite,
  getTrailDef,
  isOnMountain,
  makeCustomTrailDef,
  planCustomLift,
  planCustomTrail,
} from './trails'
import { avalancheHeld, avalancheRuns } from './operations'
import { staffCount } from './resort'
import { computeSurface } from './weather'
import { TOWN_PROJECTS, TOWN_POLICIES } from '../content/town'
import { townProposal, townPolicyProposal, townMemory } from './town'
import type { TownProject, TownPolicy } from './types'
import type { FacilityKind, GameState, LiftKind, LiftSiteDef, Prices, StaffRole, TrailState, Vec2 } from './types'

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
  const site = getLiftSite(state, siteId)
  const existing = state.lifts[siteId]
  if (!site || !existing) return 'No lift to upgrade'
  if (!site.allowedKinds.includes(kind)) return 'That lift type doesn’t fit this alignment'
  if (existing.kind === kind) return 'Already this lift type'
  // upgrade credit: half the old lift's value (length-priced for custom lines)
  const priceOf = (k: LiftKind) =>
    site.isCustom ? LIFT_BASE_COST[k] + existing.lengthM * LIFT_COST_PER_M[k] : LIFT_TYPES[k].buildCost
  const cost = priceOf(kind) - priceOf(existing.kind) * 0.5
  const err = spend(state, Math.max(0, Math.round(cost)))
  if (err) return err
  const wasOpen = existing.open
  state.lifts[siteId] = makeLiftState(siteId, kind, site.isCustom ? existing.lengthM : undefined)
  state.lifts[siteId].open = wasOpen
  pushAlert(state, 'info', `${site.name} upgraded to ${LIFT_TYPES[kind].label}`)
  return null
}

/**
 * Build a lift between two clicked points. Endpoints snap to network nodes;
 * unsnapped terminals create new stations (which future trails and lifts can
 * connect to). The lower end is always the bottom. Requires real vertical
 * rise — everything else is the designer's call.
 */
export function buildCustomLift(state: GameState, a: Vec2, b: Vec2, kind: LiftKind): string | null {
  const plan = planCustomLift(state, a, b, kind)
  if (!isOnMountain(plan.bottom) || !isOnMountain(plan.top)) {
    return 'Terminals must stand on the mountain — the ridgeline is the top'
  }
  if (plan.riseM < LIFT_MIN_RISE_M) {
    return `A lift needs at least ${LIFT_MIN_RISE_M} m of rise (this line gains ${plan.riseM} m)`
  }
  if (plan.lengthM < 120) return 'Too short — walk it'
  const err = spend(state, plan.totalCost)
  if (err) return err

  const bottomNodeId = ensureNode(state, plan.bottomNodeId, plan.bottom)
  const topNodeId = ensureNode(state, plan.topNodeId, plan.top)
  const n = Object.keys(state.customLiftSites).length
  const id = `cl-${state.day}-${n + 1}`
  const site: LiftSiteDef = {
    id,
    name: CUSTOM_LIFT_NAMES[n % CUSTOM_LIFT_NAMES.length] ?? `Lift ${n + 1}`,
    bottomNodeId,
    topNodeId,
    allowedKinds: ['surface', 'chair', 'high-speed-chair', 'gondola'],
    isCustom: true,
    buildCost: plan.totalCost,
  }
  state.customLiftSites[id] = site
  state.lifts[id] = makeLiftState(id, kind, plan.lengthM)
  state.lifts[id].open = true

  const treeNote = plan.treesToClear > 0 ? ` — ${plan.treesToClear} trees cleared` : ''
  pushAlert(state, 'info', `${site.name} built — ${LIFT_TYPES[kind].label}, ${plan.lengthM.toLocaleString()} m${treeNote}`)
  return null
}

export function setLiftOpen(state: GameState, siteId: string, open: boolean): string | null {
  const lift = state.lifts[siteId]
  if (!lift || !getLiftSite(state, siteId)) return 'Lift not built'
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
  trail.open = trail.snowDepthCm >= TRAIL_MIN_DEPTH_CM && !avalancheHeld(state, trailId)
  registerTrailJunctions(state, trailId)
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
  if (points.some((p) => !isOnMountain(p))) {
    return 'The line leaves the mountain — stay below the ridgeline and inside the area'
  }
  const plan = planCustomTrail(state, points)
  if (plan.analysis.lengthM < 120) return 'That’s barely a slide — draw a longer line'
  if (plan.conflicts.blockers.length > 0) return plan.conflicts.blockers[0]
  const err = spend(state, plan.totalCost)
  if (err) return err

  const def = makeCustomTrailDef(state, points, plan)
  state.customTrailDefs[def.id] = def

  // endpoints landing on an existing run become fork/merge junctions
  const { topMerge, bottomMerge } = plan.conflicts
  if (topMerge && !def.topNodeId) {
    const host = getTrailDef(state, topMerge.trailId)
    def.topNodeId = ensureJunction(state, topMerge.pos, [{ trailId: topMerge.trailId, t: topMerge.t }], `${host.name} fork`)
  }
  if (bottomMerge && !def.bottomNodeId) {
    const host = getTrailDef(state, bottomMerge.trailId)
    def.bottomNodeId = ensureJunction(state, bottomMerge.pos, [{ trailId: bottomMerge.trailId, t: bottomMerge.t }], `${host.name} junction`)
  }

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
    groomingPolicy: 'auto',
    hasSnowmaking: false,
    skierIds: [],
    ridesToday: 0,
    traffic: 0,
  }
  trailState.surface = computeSurface(trailState, state.weatherSeason[state.day - 1], (id) => getTrailDef(state, id))
  trailState.open = trailState.snowDepthCm >= TRAIL_MIN_DEPTH_CM
  if (avalancheHeld(state, def.id)) trailState.open = false
  state.trails[def.id] = trailState

  const crossings = registerTrailJunctions(state, def.id)

  const treeNote = plan.treesToClear > 0 ? ` — ${plan.treesToClear} trees cleared` : ''
  const mergeNote = bottomMerge ? ` — merges into ${getTrailDef(state, bottomMerge.trailId).name}` : ''
  const crossNote = crossings > 0 ? ` — ${crossings} junction${crossings > 1 ? 's' : ''}` : ''
  pushAlert(state, 'info', `${def.name} cut${treeNote}${mergeNote}${crossNote}, ${trailState.open ? 'open' : 'awaiting snow'}`)
  return null
}

export function setTrailOpen(state: GameState, trailId: string, open: boolean): string | null {
  const trail = state.trails[trailId]
  if (!trail?.built) return 'Trail not cut yet'
  if (open && avalancheHeld(state, trailId)) return 'Avalanche hold — complete morning control before opening'
  if (open && trail.snowDepthCm < TRAIL_MIN_DEPTH_CM) {
    return `Not enough snow to open (${trail.snowDepthCm} cm, needs ${TRAIL_MIN_DEPTH_CM})`
  }
  trail.open = open
  return null
}

export function setGroomingPolicy(state: GameState, trailId: string, policy: TrailState['groomingPolicy']): string | null {
  const trail = state.trails[trailId]
  if (!trail?.built) return 'Cut the trail before planning grooming'
  if (policy !== 'auto' && policy !== 'preserve') return 'Unknown grooming plan'
  trail.groomingPolicy = policy
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

/** Install a hill-wide lighting network; evening operations are chosen each morning. */
export function installNightLighting(state: GameState): string | null {
  if (state.mountainId !== 'prairie') return 'Night skiing is available at Prairie Knob'
  if (state.phase !== 'planning') return 'Install lighting before opening the resort'
  if (state.operations.nightLighting) return 'Night lighting is already installed'
  const error = spend(state, NIGHT_LIGHTING_COST)
  if (error) return error
  state.operations.nightLighting = true
  pushAlert(state, 'info', 'Prairie floodlights installed — choose evening operations before opening')
  return null
}
export function setNightSkiing(state: GameState, enabled: boolean): string | null {
  if (state.phase !== 'planning') return 'Choose evening hours before opening the resort'
  if (state.mountainId !== 'prairie' || !state.operations.nightLighting) return 'Install Prairie night lighting first'
  state.operations.nightSkiing = enabled
  return null
}
export function controlAvalanches(state: GameState): string | null {
  if (state.phase !== 'planning') return 'Avalanche control must finish before guests arrive'
  const runs = avalancheRuns(state).filter(id => avalancheHeld(state, id))
  if (!runs.length) return 'No high-risk terrain needs control today'
  if (staffCount(state, 'patrol') < AVALANCHE_CONTROL_STAFF) return `Control needs ${AVALANCHE_CONTROL_STAFF} patrollers on staff`
  const error = spend(state, runs.length * AVALANCHE_CONTROL_COST_PER_RUN)
  if (error) return error
  state.operations.controlCostToday += runs.length * AVALANCHE_CONTROL_COST_PER_RUN
  state.operations.avalancheClearedTrails = state.operations.avalancheClearedDay === state.day ? [...state.operations.avalancheClearedTrails, ...runs] : runs
  state.operations.avalancheClearedDay = state.day
  pushAlert(state, 'info', `Avalanche control complete on ${runs.length} runs — closed trails can now be reopened`)
  return null
}

/** Council votes are previewable and deterministic; a failed proposal spends nothing. */
export function proposeTownProject(state: GameState, project: TownProject, homes = false): string | null {
  if (!Object.prototype.hasOwnProperty.call(TOWN_PROJECTS, project)) return 'Unknown town project'
  if (state.phase !== 'planning') return 'Meet the council before opening the resort'
  if (state.town.construction) return 'Let the current town project finish first'
  if (homes && project !== 'inn') return 'The employee-home compact belongs to inn proposals'
  const proposal = townProposal(state, project, homes)
  if (proposal.maxed) return 'This district is fully developed'
  if (!proposal.approved) return 'Council declined — two of three representatives must support the plan'
  const error = spend(state, proposal.cost)
  if (error) return error
  state.town.construction = { project, homes, remainingDays: proposal.days, totalDays: proposal.days }
  pushAlert(state, 'info', `Council approves ${TOWN_PROJECTS[project].name} — opening in ${proposal.days} operating days`)
  return null
}

export function adoptTownPolicy(state: GameState, policy: TownPolicy): string | null {
 if (!Object.prototype.hasOwnProperty.call(TOWN_POLICIES, policy)) return 'Unknown town policy'
 if (state.phase !== 'planning') return 'Council meets during morning planning'
 if (state.town.policies[policy]) return 'This charter is already adopted'
 if (policy === 'winterMarket' && state.town.levels.mainstreet === 0) return 'Renew Main Street first'
 const proposal = townPolicyProposal(state, policy)
 if (!proposal.approved) return 'Two council votes are required'
 if (state.cash < proposal.cost) return 'Not enough cash for this charter'
 state.cash -= proposal.cost
 state.town.policies[policy] = true
 state.town.scrapbook.push(townMemory(state.town, state.day, state.season, TOWN_POLICIES[policy].name))
 pushAlert(state, 'info', `${TOWN_POLICIES[policy].name} adopted — visit the village to see the change`)
 return null
}
