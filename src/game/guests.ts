/**
 * Guest agents: spawning, needs, the objective state machine, movement,
 * trail choice, spending, memories, and departures. Runs once per sim tick.
 *
 * Movement scale: 1 world unit ≈ 2 m horizontal, so
 * speed_wu_per_tick = (m_per_min / 2) * TICK_MINUTES.
 */
import {
  BLADDER_PER_MIN,
  CHILD_FRACTION,
  DAY_END_MIN,
  ENERGY_DRAIN_IDLE_PER_MIN,
  ENERGY_DRAIN_SKI_PER_MIN,
  GUEST_START_SATISFACTION,
  HUNGER_PER_MIN,
  INCIDENT_BASE_RISK_PER_MIN,
  INCIDENT_DIFFICULTY_MULT,
  INCIDENT_SURFACE_MULT,
  LAST_ARRIVAL_MIN,
  MAX_LIVE_GUESTS,
  QUEUE_GRACE_MIN,
  RENTAL_NEED_FRACTION,
  SKI_SPEED,
  SKILL_DISTRIBUTION,
  TICK_MINUTES,
  TICKET_REFERENCE_PRICE,
  WALK_SPEED,
  WARMTH_DRAIN_BASE,
} from '../content/balance'
import { ACTIVE_MOUNTAIN, FACILITY_SLOTS, NODE_MAP, pointAt } from '../content/mountain'
import { FIRST_NAMES, LAST_NAMES } from '../content/names'
import { junctionLegsOnTrail, LEG_END_T, lineOptionsAt } from './junctions'
import { allNodes, getLiftLine, getLiftSite, getNode, getTrailDef, getTrailPath } from './trails'
import { hashNoise, type Rng } from './rng'
import {
  foodCapacity,
  hasFacility,
  patrolCoverage,
  rentalCapacityPerHour,
  reachableNodes,
  runningLifts,
} from './resort'
import { SURFACE_ENJOYMENT } from './weather'
import type { GameState, Guest, GroupType, SkillLevel, Vec2 } from './types'

// ------------------------------------------------------------------ spawn

const GROUP_TYPES: { item: GroupType; weight: number }[] = [
  { item: 'solo', weight: 0.15 },
  { item: 'couple', weight: 0.25 },
  { item: 'family', weight: 0.3 },
  { item: 'friends', weight: 0.22 },
  { item: 'school-group', weight: 0.08 },
]


/** arrival envelope over the day — peaks mid-morning, zero after gate close */
function arrivalWeight(minute: number): number {
  if (minute >= LAST_ARRIVAL_MIN) return 0
  const h = minute / 60
  // gaussian centred 10:15
  return Math.exp(-((h - 10.25) ** 2) / 2.2)
}

// integral of arrivalWeight over operating minutes (computed once)
let ENVELOPE_TOTAL = 0
for (let m = 8 * 60 + 30; m < LAST_ARRIVAL_MIN; m++) ENVELOPE_TOTAL += arrivalWeight(m)

export function spawnArrivals(state: GameState, rng: Rng): void {
  if (state.minute >= LAST_ARRIVAL_MIN) return
  const alive = Object.keys(state.guests).length
  if (alive >= MAX_LIVE_GUESTS) return

  const perMinute = (state.targetDemandToday * arrivalWeight(state.minute)) / ENVELOPE_TOTAL
  state.arrivalCarry += perMinute * TICK_MINUTES
  while (state.arrivalCarry >= 1) {
    state.arrivalCarry -= 1
    const g = makeGuest(state, rng)
    state.guests[g.id] = g
    state.guestsArrivedToday++
    state.totalGuestsSeason++
  }
}

function makeGuest(state: GameState, rng: Rng): Guest {
  // the mountain shapes its crowd: learners' hills vs powder pilgrimages
  const mix = SKILL_DISTRIBUTION.map((e) => ({
    item: e.item,
    weight: e.weight * (ACTIVE_MOUNTAIN.clientele?.[e.item] ?? 1),
  }))
  const skill = rng.pickWeighted(mix)
  const groupType = rng.pickWeighted(GROUP_TYPES)
  const isChild = rng.chance(groupType === 'family' || groupType === 'school-group' ? 0.45 : CHILD_FRACTION * 0.5)
  const budgetBase: Record<GroupType, [number, number]> = {
    solo: [70, 160],
    couple: [90, 200],
    family: [80, 180],
    friends: [75, 170],
    'school-group': [45, 90],
  }
  const [bMin, bMax] = budgetBase[groupType]
  const riskBySkill: Record<SkillLevel, number> = {
    'first-timer': 0.08,
    beginner: 0.18,
    intermediate: 0.4,
    advanced: 0.62,
    expert: 0.8,
  }
  return {
    id: state.nextGuestId++,
    name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
    skill,
    groupType,
    budget: Math.round(rng.bell(bMin, bMax)),
    spent: 0,
    energy: rng.range(78, 100),
    patience: rng.bell(35, 95),
    satisfaction: GUEST_START_SATISFACTION + rng.range(-6, 6),
    riskTolerance: clamp01(riskBySkill[skill] + rng.range(-0.12, 0.12)),
    prefersTrees: rng.chance(0.35),
    arrivalMinute: state.minute,
    hasTicket: false,
    needsRental: rng.chance(RENTAL_NEED_FRACTION),
    hasRental: false,
    hunger: rng.range(15, 45),
    bladder: rng.range(5, 35),
    warmth: rng.range(85, 100),
    objective: 'arriving',
    pos: { x: ACTIVE_MOUNTAIN.entrance.x + rng.range(-14, 14), y: ACTIVE_MOUNTAIN.entrance.y + rng.range(-8, 8) },
    atNodeId: null,
    routeLiftId: null,
    routeTrailId: null,
    progress: 0,
    walkTarget: null,
    busyMinutes: 0,
    facilityKind: null,
    plan: [],
    plannedTrailId: null,
    runsCompleted: 0,
    memories: [],
    injured: false,
    queuedMinutes: 0,
    lastTrailId: null,
    hadLesson: false,
    noFoodComplained: false,
    noRestroomComplained: false,
    isChild,
    venuePrice: 0,
    stuckSegIdx: -1,
  }
}

// --------------------------------------------------------------- memories

/**
 * Joy has diminishing returns: an already-delighted guest gains less from
 * one more good thing, so satisfaction settles in the high 80s instead of
 * pegging at 100. Grievances always land at full weight.
 */
function easedDelta(current: number, delta: number): number {
  if (delta <= 0) return delta
  return delta * Math.max(0.3, (105 - current) / 60)
}

export function remember(guest: Guest, kind: string, text: string, delta: number, minute: number): void {
  guest.memories.push({ kind, text, delta, minute })
  guest.satisfaction = clamp(guest.satisfaction + easedDelta(guest.satisfaction, delta), 0, 100)
}

// ------------------------------------------------------------------- tick

export function tickGuests(state: GameState, rng: Rng): void {
  const weather = state.weatherSeason[state.day - 1]
  const coldFactor = Math.max(0, -weather.tempHigh) * 0.045 + (weather.windKph > 35 ? 0.35 : 0)

  for (const guest of Object.values(state.guests)) {
    // ---- universal need drift
    guest.hunger = clamp(guest.hunger + HUNGER_PER_MIN * TICK_MINUTES, 0, 100)
    guest.bladder = clamp(guest.bladder + BLADDER_PER_MIN * TICK_MINUTES, 0, 100)

    const indoors =
      guest.objective === 'eating' ||
      guest.objective === 'resting' ||
      guest.objective === 'restroom' ||
      guest.objective === 'first-aid' ||
      (guest.objective === 'riding' && guest.routeLiftId !== null && state.lifts[guest.routeLiftId]?.kind === 'gondola')
    if (indoors) {
      guest.warmth = clamp(guest.warmth + 1.6 * TICK_MINUTES, 0, 100)
    } else {
      guest.warmth = clamp(guest.warmth - (WARMTH_DRAIN_BASE + coldFactor) * TICK_MINUTES, 0, 100)
    }
    guest.energy = clamp(
      guest.energy -
        (guest.objective === 'skiing' ? ENERGY_DRAIN_SKI_PER_MIN : ENERGY_DRAIN_IDLE_PER_MIN) * TICK_MINUTES,
      0,
      100,
    )

    // being cold is miserable
    if (guest.warmth < 15) guest.satisfaction = clamp(guest.satisfaction - 0.25 * TICK_MINUTES, 0, 100)

    switch (guest.objective) {
      case 'arriving':
        tickArriving(state, guest)
        break
      case 'walking':
        tickWalking(state, guest)
        break
      case 'buying-ticket':
      case 'renting':
      case 'eating':
      case 'restroom':
      case 'resting':
      case 'first-aid':
        tickBusy(state, guest, rng)
        break
      case 'to-lift':
        tickToLift(state, guest)
        break
      case 'queueing':
        tickQueueing(state, guest)
        break
      case 'riding':
        // boarding/arrival handled in lifts.ts; riders just track their chair
        updateRiderPos(state, guest)
        break
      case 'skiing':
        tickSkiing(state, guest, rng)
        break
      case 'leaving':
        tickLeaving(state, guest)
        break
      case 'gone':
        break
    }
  }

  const alive = Object.keys(state.guests).length
  if (alive > state.peakGuestsToday) state.peakGuestsToday = alive
}

// -------------------------------------------------------------- movement

function moveToward(guest: Guest, target: Vec2, mPerMin: number): boolean {
  const step = (mPerMin / 2) * TICK_MINUTES
  const dx = target.x - guest.pos.x
  const dy = target.y - guest.pos.y
  const d = Math.hypot(dx, dy)
  if (d <= step) {
    guest.pos = { ...target }
    return true
  }
  guest.pos = { x: guest.pos.x + (dx / d) * step, y: guest.pos.y + (dy / d) * step }
  return false
}

function slotPos(kind: string, state: GameState): Vec2 | null {
  for (const slot of FACILITY_SLOTS) {
    if (state.facilities[slot.id] === kind) return slot.pos
  }
  return null
}

// ------------------------------------------------------------ state steps

function tickArriving(state: GameState, guest: Guest): void {
  const ticket = slotPos('ticket-office', state) ?? NODE_MAP.base.pos
  if (moveToward(guest, ticket, WALK_SPEED)) {
    guest.objective = 'buying-ticket'
    guest.busyMinutes = 1.5 + Math.min(6, countBuying(state) * 0.3)
  }
}

function countBuying(state: GameState): number {
  let n = 0
  for (const g of Object.values(state.guests)) if (g.objective === 'buying-ticket') n++
  return n
}

function tickWalking(state: GameState, guest: Guest): void {
  if (!guest.walkTarget) {
    decideNext(state, guest)
    return
  }
  if (moveToward(guest, guest.walkTarget, WALK_SPEED)) {
    guest.walkTarget = null
    if (guest.facilityKind) {
      enterFacility(state, guest)
    } else {
      decideNext(state, guest)
    }
  }
}

/** transition into the busy state matching why the guest walked here */
function enterFacility(state: GameState, guest: Guest): void {
  if (guest.venuePrice > 0) {
    startEating(state, guest)
    return
  }
  switch (guest.facilityKind) {
    case 'rental-shop': {
      const renters = Object.values(state.guests).filter((g) => g.objective === 'renting').length
      const perHour = Math.max(1, rentalCapacityPerHour(state))
      guest.objective = 'renting'
      guest.busyMinutes = 5 + Math.max(0, renters - perHour / 12) * 2
      if (guest.busyMinutes > 18) {
        guest.satisfaction = clamp(guest.satisfaction - 5, 0, 100)
      }
      return
    }
    case 'restroom':
      guest.objective = 'restroom'
      guest.busyMinutes = 4
      return
    case 'base-lodge':
      guest.objective = 'resting'
      guest.busyMinutes = 18
      return
    default:
      guest.facilityKind = null
      decideNext(state, guest)
  }
}

/** shared countdown for all "busy at a facility" states */
function tickBusy(state: GameState, guest: Guest, rng: Rng): void {
  guest.busyMinutes -= TICK_MINUTES
  if (guest.busyMinutes > 0) return

  switch (guest.objective) {
    case 'buying-ticket': {
      const price = guest.isChild ? state.prices.childTicket : state.prices.adultTicket
      guest.hasTicket = true
      guest.spent += price
      state.revenueToday.tickets += price
      state.cash += price
      // parking fee on arrival too
      state.revenueToday.parking += state.prices.parking / 2.6 // ~cars per guest
      state.cash += state.prices.parking / 2.6
      if (price > TICKET_REFERENCE_PRICE * 1.35 || price > guest.budget * 0.55) {
        remember(guest, 'expensive', 'winced at the ticket price', -7, state.minute)
      }
      if (guest.needsRental && !guest.hasRental) {
        const shopPos = slotPos('rental-shop', state)
        if (!shopPos || rentalCapacityPerHour(state) <= 0) {
          remember(guest, 'no-rental', 'couldn’t rent gear', -30, state.minute)
          guest.objective = 'leaving'
          return
        }
        guest.walkTarget = shopPos
        guest.objective = 'walking'
        guest.facilityKind = 'rental-shop'
        return
      }
      decideNext(state, guest)
      return
    }
    case 'renting': {
      guest.hasRental = true
      guest.spent += state.prices.rental
      state.revenueToday.rentals += state.prices.rental
      state.cash += state.prices.rental
      guest.facilityKind = null
      decideNext(state, guest)
      return
    }
    case 'eating': {
      guest.hunger = 12
      const foodMult = [0.75, 1, 1.35][state.prices.foodLevel - 1] ?? 1
      const spend = Math.round((guest.venuePrice || 16) * foodMult)
      guest.spent += spend
      state.revenueToday.food += spend
      state.cash += spend
      const quality = state.prices.foodLevel
      if (quality >= 2 && rng.chance(0.5)) {
        remember(guest, 'good-meal', 'had a great meal', +8, state.minute)
      } else if (quality === 1 && rng.chance(0.3)) {
        guest.satisfaction = clamp(guest.satisfaction - 3, 0, 100)
      }
      guest.venuePrice = 0
      guest.facilityKind = null
      decideNext(state, guest)
      return
    }
    case 'restroom': {
      guest.bladder = 5
      guest.facilityKind = null
      decideNext(state, guest)
      return
    }
    case 'resting': {
      guest.energy = clamp(guest.energy + 25, 0, 100)
      guest.warmth = 95
      if (rng.chance(0.35)) remember(guest, 'cozy-lodge', 'warmed up in the lodge', +5, state.minute)
      guest.facilityKind = null
      decideNext(state, guest)
      return
    }
    case 'first-aid': {
      guest.objective = 'leaving'
      return
    }
    default:
      decideNext(state, guest)
  }
}

function tickToLift(state: GameState, guest: Guest): void {
  const liftId = guest.plan[0]
  if (!liftId || !state.lifts[liftId]) {
    decideNext(state, guest)
    return
  }
  const site = getLiftSite(state, liftId)
  const bottom = getNode(state, site.bottomNodeId)!.pos
  if (moveToward(guest, bottom, WALK_SPEED * 1.4)) {
    const lift = state.lifts[liftId]
    // lift may have closed while walking over
    if (!lift.open || lift.forcedClosed) {
      guest.plan = []
      decideNext(state, guest)
      return
    }
    guest.objective = 'queueing'
    guest.queuedMinutes = 0
    lift.queue.push(guest.id)
  }
}

function tickQueueing(state: GameState, guest: Guest): void {
  guest.queuedMinutes += TICK_MINUTES
  // shuffle queue dot cloud near the lift base
  const liftId = guest.plan[0]
  if (!liftId) return
  const site = getLiftSite(state, liftId)
  const idx = state.lifts[liftId]?.queue.indexOf(guest.id) ?? 0
  const bottom = getNode(state, site.bottomNodeId)!.pos
  guest.pos = { x: bottom.x + 6 + (idx % 8) * 3.4, y: bottom.y + 6 + Math.floor(idx / 8) * 3.2 }

  const grace = QUEUE_GRACE_MIN * (0.5 + guest.patience / 100)
  if (guest.queuedMinutes > grace) {
    guest.satisfaction = clamp(guest.satisfaction - 0.35 * TICK_MINUTES, 0, 100)
  }
  // bail on hopeless lines
  if (guest.queuedMinutes > grace * 3.2) {
    const lift = state.lifts[liftId]
    if (lift) lift.queue = lift.queue.filter((id) => id !== guest.id)
    remember(guest, 'long-line', 'gave up on a lift line', -12, state.minute)
    guest.plan = []
    decideNext(state, guest)
  }
}

function updateRiderPos(state: GameState, guest: Guest): void {
  const liftId = guest.routeLiftId
  if (!liftId) return
  const lift = state.lifts[liftId]
  const rider = lift?.riders.find((r) => r.guestId === guest.id)
  if (!lift || !rider) return
  const t = clamp01((minuteOf(state) - rider.boardedMinute) / lift.rideMinutes)
  guest.pos = pointAt(getLiftLine(state, liftId), t)
}

function minuteOf(state: GameState): number {
  return state.minute
}

function tickSkiing(state: GameState, guest: Guest, rng: Rng): void {
  const trailId = guest.routeTrailId
  if (!trailId) {
    decideNext(state, guest)
    return
  }
  const def = getTrailDef(state, trailId)
  const trail = state.trails[trailId]
  const surfaceSpeed: Record<string, number> = {
    'fresh-powder': 0.85,
    groomed: 1.12,
    'packed-powder': 1,
    firm: 1.05,
    icy: 1.02,
    thin: 0.8,
    'wind-affected': 0.85,
  }
  let speed = SKI_SPEED[guest.skill] * (surfaceSpeed[trail.surface] ?? 1)

  // a line that climbs back uphill stops being skiing: guests slog through
  // at hiking pace and remember whose bright idea this trail was
  const segs = def.uphillSegments ?? []
  const segIdx = segs.findIndex((s) => guest.progress >= s.t0 && guest.progress < s.t1)
  if (segIdx >= 0) {
    speed *= 0.2
    if (guest.stuckSegIdx !== segIdx) {
      guest.stuckSegIdx = segIdx
      if (rng.chance(0.6)) {
        remember(guest, 'stuck-trail', `got stuck hiking uphill on ${def.name}`, -10, state.minute)
      } else {
        guest.satisfaction = clamp(guest.satisfaction - 5, 0, 100)
      }
      guest.energy = clamp(guest.energy - 4, 0, 100)
    }
  } else if (guest.stuckSegIdx !== -1) {
    guest.stuckSegIdx = -1
  }

  const prevProgress = guest.progress
  guest.progress += (speed * TICK_MINUTES) / def.lengthM
  guest.pos = pointAt(getTrailPath(state, trailId), guest.progress)

  // incident roll
  const crowd = trail.skierIds.length / def.capacity
  const risk =
    INCIDENT_BASE_RISK_PER_MIN *
    TICK_MINUTES *
    def.riskFactor *
    INCIDENT_DIFFICULTY_MULT[def.difficulty] *
    (INCIDENT_SURFACE_MULT[trail.surface] ?? 1) *
    (1 + Math.max(0, crowd - 0.7)) *
    (1.25 - guest.riskTolerance * 0.5)
  if (rng.chance(risk)) {
    handleIncident(state, guest, rng)
    return
  }

  // a junction passed this tick is a chance to pick a different line
  for (const leg of junctionLegsOnTrail(state, trailId)) {
    if (prevProgress < leg.t && guest.progress >= leg.t && leg.t < LEG_END_T) {
      if (maybeSwitchLine(state, guest, leg.nodeId, trailId)) return
      break
    }
  }

  if (guest.progress >= 1) {
    finishRun(state, guest, rng)
  }
}

function handleIncident(state: GameState, guest: Guest, rng: Rng): void {
  const trailId = guest.routeTrailId!
  const trail = state.trails[trailId]
  trail.skierIds = trail.skierIds.filter((id) => id !== guest.id)
  const coverage = patrolCoverage(state)
  const serious = rng.chance(clamp01(0.3 * (coverage < 0.8 ? 1.6 : 1)))
  guest.injured = true
  remember(guest, 'injury', 'took a bad fall', serious ? -45 : -18, state.minute)
  if (serious) {
    state.incidentsToday++
    pushAlert(state, 'critical', `Skier down on ${getTrailDef(state, trailId).name} — patrol responding`)
  }
  // patrol sleds them to the base
  guest.routeTrailId = null
  guest.progress = 0
  guest.pos = { ...NODE_MAP.base.pos }
  guest.atNodeId = 'base'
  if (hasFacility(state, 'first-aid')) {
    const pos = slotPos('first-aid', state)!
    guest.pos = { ...pos }
    guest.objective = 'first-aid'
    guest.busyMinutes = 25
    guest.satisfaction = clamp(guest.satisfaction + 8, 0, 100) // handled well
  } else {
    guest.objective = 'leaving'
  }
}

function finishRun(state: GameState, guest: Guest, rng: Rng): void {
  const trailId = guest.routeTrailId!
  const def = getTrailDef(state, trailId)
  const trail = state.trails[trailId]
  trail.skierIds = trail.skierIds.filter((id) => id !== guest.id)
  trail.ridesToday++
  trail.traffic += 1
  guest.routeTrailId = null
  guest.progress = 0
  guest.stuckSegIdx = -1
  guest.runsCompleted++
  guest.lastTrailId = trailId

  const bottom = getNode(state, def.bottomNodeId)
  if (bottom) {
    guest.atNodeId = def.bottomNodeId
    guest.pos = { ...bottom.pos }
  } else {
    // the run dead-ends in the middle of nowhere — patrol sleds them out
    remember(guest, 'stranded', `got stranded at the end of ${def.name}`, -18, state.minute)
    if (trail.ridesToday === 1) {
      pushAlert(state, 'warning', `${def.name} dead-ends mid-mountain — patrol is sledding skiers back to base`)
    }
    guest.atNodeId = 'base'
    guest.pos = { ...NODE_MAP.base.pos }
  }

  // ---- experience of the run
  const fit = difficultyFit(guest.skill, def.difficulty, guest.riskTolerance)
  const enjoy = SURFACE_ENJOYMENT[trail.surface]
  const crowd = trail.skierIds.length / def.capacity
  let delta = 6 * fit * enjoy - 2
  if (crowd > 0.85) {
    delta -= 4
    if (rng.chance(0.4)) remember(guest, 'crowded-trail', 'trail felt mobbed', -3, state.minute)
  }
  if (trail.surface === 'fresh-powder' && rng.chance(0.6)) {
    remember(guest, 'powder-run', 'floated through fresh powder', +9, state.minute)
  } else if (trail.surface === 'groomed' && rng.chance(0.3)) {
    remember(guest, 'groomed-run', 'carved fresh corduroy', +6, state.minute)
  } else if (trail.surface === 'icy' && rng.chance(0.5)) {
    remember(guest, 'icy-trail', 'scraped down boilerplate', -6, state.minute)
  } else if (trail.surface === 'thin' && rng.chance(0.5)) {
    remember(guest, 'thin-cover', 'dodged rocks on thin cover', -5, state.minute)
  }
  const weather = state.weatherSeason[state.day - 1]
  if (def.scenicAppeal > 0.75 && weather.visibility > 0.7 && rng.chance(0.35)) {
    remember(guest, 'scenic-run', 'stopped to take in the view', +5, state.minute)
  }
  if (fit < 0.2) {
    remember(guest, 'wrong-terrain', 'was in over their head', -8, state.minute)
  }
  guest.satisfaction = clamp(guest.satisfaction + easedDelta(guest.satisfaction, delta), 0, 100)

  decideNext(state, guest)
}

function tickLeaving(state: GameState, guest: Guest): void {
  // guests on the hill first return to base via decideNext; here they walk out
  if (moveToward(guest, ACTIVE_MOUNTAIN.entrance, WALK_SPEED * 1.2)) {
    depart(state, guest)
  }
}

function depart(state: GameState, guest: Guest): void {
  state.departedToday.push({
    satisfaction: guest.satisfaction,
    name: guest.name,
    skill: guest.skill,
    memories: guest.memories,
    spent: guest.spent,
  })
  delete state.guests[guest.id]
}

// --------------------------------------------------------------- decisions

export function decideNext(state: GameState, guest: Guest): void {
  const minute = state.minute

  // day is ending or guest is spent
  if (guest.injured || guest.energy < 12 || minute > DAY_END_MIN - 25) {
    routeTowardExit(state, guest)
    return
  }
  // satisfaction crash → storm off
  if (guest.satisfaction < 18 && guest.runsCompleted > 0) {
    routeTowardExit(state, guest)
    return
  }

  const atBase = guest.atNodeId === null || getNode(state, guest.atNodeId)?.isBase

  // needs first (services mostly live at the base; m1 is the mid-mountain slot)
  if (guest.hunger > 68) {
    const venue = pickFoodVenue(state, guest)
    if (venue) {
      const nearVenue = atBase || venue.slotId === 'm1'
      if (!nearVenue) {
        routeToBaseThenContinue(state, guest)
        return
      }
      guest.facilityKind = venue.kind
      guest.venuePrice = venue.price
      if (isAt(guest, venue.pos)) {
        startEating(state, guest)
      } else {
        guest.walkTarget = venue.pos
        guest.objective = 'walking'
      }
      return
    } else if (!guest.noFoodComplained && guest.hunger > 80) {
      guest.noFoodComplained = true
      remember(guest, 'no-food', 'found nowhere to eat', -12, state.minute)
    }
  }

  if (guest.bladder > 78) {
    const pos = slotPos('restroom', state) ?? (hasFacility(state, 'base-lodge') ? slotPos('base-lodge', state) : null)
    if (pos) {
      if (!atBase) {
        routeToBaseThenContinue(state, guest)
        return
      }
      guest.walkTarget = pos
      guest.objective = 'walking'
      guest.facilityKind = 'restroom'
      return
    } else if (!guest.noRestroomComplained) {
      guest.noRestroomComplained = true
      remember(guest, 'no-restroom', 'couldn’t find a restroom', -10, state.minute)
      guest.bladder = 30 // they found a tree, dignity intact-ish
    }
  }

  if (guest.warmth < 22) {
    const lodge = slotPos('base-lodge', state)
    if (lodge) {
      if (!atBase) {
        routeToBaseThenContinue(state, guest)
        return
      }
      guest.walkTarget = lodge
      guest.objective = 'walking'
      guest.facilityKind = 'base-lodge'
      return
    } else {
      remember(guest, 'cold-wait', 'froze with nowhere to warm up', -10, state.minute)
      routeTowardExit(state, guest)
      return
    }
  }

  if (guest.energy < 30 && hasFacility(state, 'base-lodge') && atBase) {
    guest.walkTarget = slotPos('base-lodge', state)!
    guest.objective = 'walking'
    guest.facilityKind = 'base-lodge'
    return
  }

  // lesson for novices
  if (
    !guest.hadLesson &&
    (guest.skill === 'first-timer' || guest.skill === 'beginner') &&
    hasFacility(state, 'ski-school') &&
    lessonsAvailable(state) &&
    atBase &&
    guest.budget - guest.spent > state.prices.lesson
  ) {
    startLesson(state, guest)
    return
  }

  // ---- otherwise: go ski something
  const choice = chooseTrail(state, guest)
  if (!choice) {
    // standing at a mid-run fork: pick a line onward rather than griping
    if (guest.atNodeId && state.junctions[guest.atNodeId]) {
      const line = pickLine(state, guest, lineOptionsAt(state, guest.atNodeId, null))
      if (line) {
        startSkiing(state, guest, line.trailId, line.entryT)
        return
      }
    }
    if (!guest.memories.some((m) => m.kind === 'nothing-to-ski' || m.kind === 'wrong-terrain')) {
      const anyOpen = Object.values(state.trails).some((t) => t.open)
      remember(
        guest,
        anyOpen ? 'wrong-terrain' : 'nothing-to-ski',
        anyOpen ? 'found no trails for their level' : 'found nothing open',
        -14,
        state.minute,
      )
    } else {
      guest.satisfaction = clamp(guest.satisfaction - 1.5, 0, 100)
    }
    // linger a little, then likely leave
    if (guest.satisfaction < 45 || state.minute > LAST_ARRIVAL_MIN) {
      routeTowardExit(state, guest)
    } else {
      guest.objective = 'walking'
      guest.walkTarget = jitterAround(NODE_MAP.base.pos, 30, guest.id)
    }
    return
  }

  guest.plannedTrailId = choice.trailId
  guest.plan = choice.liftPlan
  if (choice.liftPlan.length === 0) {
    // already at the trail top
    startSkiing(state, guest, choice.trailId)
  } else {
    guest.objective = 'to-lift'
  }
}

function startEating(state: GameState, guest: Guest): void {
  guest.objective = 'eating'
  guest.busyMinutes = guest.facilityKind === 'restaurant' ? 32 : 18
  // capacity crunch: slower service, grumpier guests
  const eaters = Object.values(state.guests).filter((g) => g.objective === 'eating').length
  const cap = foodCapacity(state)
  if (cap > 0 && eaters > cap) {
    guest.busyMinutes += 12
    guest.satisfaction = clamp(guest.satisfaction - 4, 0, 100)
  }
}

function startLesson(state: GameState, guest: Guest): void {
  guest.hadLesson = true
  guest.spent += state.prices.lesson
  state.revenueToday.lessons += state.prices.lesson
  state.cash += state.prices.lesson
  guest.objective = 'resting' // reuse busy mechanics: parked at ski school
  guest.busyMinutes = 45
  guest.walkTarget = null
  const pos = slotPos('ski-school', state)!
  guest.pos = { ...pos }
  if (guest.skill === 'first-timer') guest.skill = 'beginner'
  remember(guest, 'great-lesson', 'took a confidence-building lesson', +12, state.minute)
}

function lessonsAvailable(state: GameState): boolean {
  const instructors = state.staff.find((d) => d.role === 'instructors')?.headcount ?? 0
  const lessonsToday = state.revenueToday.lessons / Math.max(1, state.prices.lesson)
  return instructors > 0 && lessonsToday < instructors * 6
}

function isAt(guest: Guest, pos: Vec2): boolean {
  return Math.hypot(guest.pos.x - pos.x, guest.pos.y - pos.y) < 4
}

function pickFoodVenue(
  state: GameState,
  guest: Guest,
): { pos: Vec2; kind: 'cafe' | 'restaurant' | 'base-lodge'; price: number; slotId: string } | null {
  const options: { pos: Vec2; kind: 'cafe' | 'restaurant' | 'base-lodge'; price: number; slotId: string }[] = []
  for (const slot of FACILITY_SLOTS) {
    const built = state.facilities[slot.id]
    if (built === 'cafe') options.push({ pos: slot.pos, kind: 'cafe', price: 14, slotId: slot.id })
    if (built === 'restaurant') options.push({ pos: slot.pos, kind: 'restaurant', price: 27, slotId: slot.id })
    if (built === 'base-lodge') options.push({ pos: slot.pos, kind: 'base-lodge', price: 11, slotId: slot.id })
  }
  if (options.length === 0) return null
  // prefer close + affordable; big spenders prefer the restaurant
  const wealthy = guest.budget - guest.spent > 60
  options.sort((a, b) => {
    const da = Math.hypot(guest.pos.x - a.pos.x, guest.pos.y - a.pos.y) - (wealthy && a.kind === 'restaurant' ? 200 : 0)
    const db = Math.hypot(guest.pos.x - b.pos.x, guest.pos.y - b.pos.y) - (wealthy && b.kind === 'restaurant' ? 200 : 0)
    return da - db
  })
  return options[0]
}

function jitterAround(pos: Vec2, radius: number, salt: number): Vec2 {
  // deterministic-ish scatter that doesn't consume the sim stream
  const a = ((salt * 2654435761) % 360) * (Math.PI / 180)
  return { x: pos.x + Math.cos(a) * radius, y: pos.y + Math.sin(a) * radius * 0.5 }
}

/** guest is mid-mountain and needs base services: ski the easiest way down first */
function routeToBaseThenContinue(state: GameState, guest: Guest): void {
  const down = easiestTrailDown(state, guest.atNodeId!)
  if (down) {
    startSkiing(state, guest, down.trailId, down.entryT)
  } else {
    // stranded — download on a lift if one runs here, else patrol assist
    const lift = runningLifts(state).find((l) => getLiftSite(state, l.siteId).topNodeId === guest.atNodeId)
    guest.atNodeId = 'base'
    guest.pos = { ...NODE_MAP.base.pos }
    if (!lift) guest.satisfaction = clamp(guest.satisfaction - 5, 0, 100)
    decideNext(state, guest)
  }
}

function routeTowardExit(state: GameState, guest: Guest): void {
  const atBase = guest.atNodeId === null || getNode(state, guest.atNodeId)?.isBase
  if (atBase) {
    guest.objective = 'leaving'
    return
  }
  const down = easiestTrailDown(state, guest.atNodeId!)
  if (down) {
    startSkiing(state, guest, down.trailId, down.entryT)
  } else {
    guest.atNodeId = 'base'
    guest.pos = { ...NODE_MAP.base.pos }
    guest.objective = 'leaving'
  }
}

const DIFF_ORDER = { green: 0, blue: 1, black: 2, 'double-black': 3 } as const

/**
 * Easiest open way downhill from a node: trails starting here, plus lines
 * entered mid-way where a junction sits on this node. Never a dead end.
 */
function easiestTrailDown(state: GameState, nodeId: string): { trailId: string; entryT: number } | null {
  const options = lineOptionsAt(state, nodeId, null).filter((o) =>
    Boolean(getNode(state, getTrailDef(state, o.trailId).bottomNodeId)),
  )
  options.sort(
    (a, b) =>
      DIFF_ORDER[getTrailDef(state, a.trailId).difficulty] - DIFF_ORDER[getTrailDef(state, b.trailId).difficulty],
  )
  return options[0] ?? null
}

// ---- junction line choice ---------------------------------------------

/** desirability of skiing (the rest of) a trail from entryT — chooseTrail's core, minus lift logistics */
function scoreLine(state: GameState, guest: Guest, trailId: string, entryT: number): number {
  const trail = state.trails[trailId]
  const def = getTrailDef(state, trailId)
  if (!trail?.built || !trail.open) return 0
  const fit = difficultyFit(guest.skill, def.difficulty, guest.riskTolerance)
  if (fit <= 0.02) return 0
  let score = fit * SURFACE_ENJOYMENT[trail.surface]
  const crowd = trail.skierIds.length / def.capacity
  if (crowd > 0.8) score *= 0.55
  if (guest.lastTrailId === trailId) score *= 0.85
  // uphill stretches still ahead of the entry point
  const uphillLeft = (def.uphillSegments ?? []).reduce((s, u) => s + Math.max(0, u.t1 - Math.max(u.t0, entryT)), 0)
  score *= Math.max(0.12, 1 - uphillLeft * 2.2)
  return score
}

/** pick a line from a standing start at a junction — someone must get down somehow */
function pickLine(
  state: GameState,
  guest: Guest,
  options: { trailId: string; entryT: number }[],
): { trailId: string; entryT: number } | null {
  if (options.length === 0) return null
  const scored = options
    .map((o) => ({ ...o, score: scoreLine(state, guest, o.trailId, o.entryT) }))
    .sort((a, b) => b.score - a.score)
  if (scored[0].score > 0.05) {
    const second = scored.length > 1 && scored[1].score > 0.05 && (guest.id * 7919) % 10 < 3
    return scored[second ? 1 : 0]
  }
  // nothing suits their level; swallow hard and take the easiest way down
  return [...options].sort(
    (a, b) =>
      DIFF_ORDER[getTrailDef(state, a.trailId).difficulty] - DIFF_ORDER[getTrailDef(state, b.trailId).difficulty],
  )[0]
}

/** mid-run: passing a junction, stay the course or cut over to a crossing line */
function maybeSwitchLine(state: GameState, guest: Guest, nodeId: string, currentTrailId: string): boolean {
  const options = lineOptionsAt(state, nodeId, currentTrailId)
  if (options.length === 0) return false
  const scored = options
    .map((o) => ({ ...o, score: scoreLine(state, guest, o.trailId, o.entryT) }))
    .sort((a, b) => b.score - a.score)
  // momentum: the line under their skis wins ties
  const continueScore = scoreLine(state, guest, currentTrailId, guest.progress) * 1.25
  const pickIdx = scored.length > 1 && scored[1].score > continueScore && (guest.id * 7919 + nodeId.length) % 10 < 3 ? 1 : 0
  const best = scored[pickIdx]
  if (!best || best.score <= continueScore || best.score <= 0.05) return false

  const cur = state.trails[currentTrailId]
  cur.skierIds = cur.skierIds.filter((id) => id !== guest.id)
  startSkiing(state, guest, best.trailId, best.entryT)
  return true
}

/** called by the lift system when a rider reaches the top station */
export function onLiftArrival(state: GameState, guest: Guest, liftId: string): void {
  const site = getLiftSite(state, liftId)
  guest.routeLiftId = null
  guest.atNodeId = site.topNodeId
  guest.pos = { ...getNode(state, site.topNodeId)!.pos }
  guest.queuedMinutes = 0
  if (guest.plan[0] === liftId) guest.plan.shift()

  if (guest.plan.length > 0) {
    guest.objective = 'to-lift'
    return
  }
  const planned = guest.plannedTrailId
  guest.plannedTrailId = null
  if (planned && state.trails[planned]?.open && getTrailDef(state, planned).topNodeId === site.topNodeId) {
    startSkiing(state, guest, planned)
  } else {
    decideNext(state, guest)
  }
}

function startSkiing(state: GameState, guest: Guest, trailId: string, entryT = 0): void {
  guest.objective = 'skiing'
  guest.routeTrailId = trailId
  guest.progress = entryT
  guest.stuckSegIdx = -1
  guest.atNodeId = null
  guest.plan = []
  guest.plannedTrailId = null
  state.trails[trailId].skierIds.push(guest.id)
  guest.pos = pointAt(getTrailPath(state, trailId), entryT)
}

// ---- trail choice ----------------------------------------------------

export function difficultyFit(skill: SkillLevel, diff: keyof typeof DIFF_ORDER, riskTolerance: number): number {
  const table: Record<SkillLevel, Record<string, number>> = {
    'first-timer': { green: 1, blue: 0.05, black: 0, 'double-black': 0 },
    beginner: { green: 1, blue: 0.3, black: 0.02, 'double-black': 0 },
    intermediate: { green: 0.35, blue: 1, black: 0.3, 'double-black': 0.05 },
    advanced: { green: 0.15, blue: 0.7, black: 1, 'double-black': 0.55 },
    expert: { green: 0.08, blue: 0.4, black: 1, 'double-black': 1.15 },
  }
  let fit = table[skill][diff]
  // risk appetite nudges people up or down a grade
  if (diff === 'black' || diff === 'double-black') fit *= 0.6 + riskTolerance * 0.8
  return fit
}

interface TrailChoice {
  trailId: string
  liftPlan: string[]
  score: number
}

export function chooseTrail(state: GameState, guest: Guest): TrailChoice | null {
  const reach = reachableNodes(state)
  const from = guest.atNodeId ?? 'base'
  const options: TrailChoice[] = []

  for (const trail of Object.values(state.trails)) {
    if (!trail.built || !trail.open) continue
    const def = getTrailDef(state, trail.trailId)
    if (!reach.has(def.topNodeId)) continue
    const plan = planLifts(state, from, def.topNodeId)
    if (plan === null) continue

    const fit = difficultyFit(guest.skill, def.difficulty, guest.riskTolerance)
    if (fit <= 0.02) continue

    let score = fit * SURFACE_ENJOYMENT[trail.surface]
    const crowd = trail.skierIds.length / def.capacity
    if (crowd > 0.8) score *= 0.55
    // queue aversion, scaled by patience
    const queueMin = plan.reduce((sum, liftId) => sum + estimatedWait(state, liftId), 0)
    score *= Math.max(0.15, 1 - queueMin / (QUEUE_GRACE_MIN * (1 + guest.patience / 40)))
    if (guest.lastTrailId === trail.trailId) score *= 0.65
    score *= 1 + def.scenicAppeal * 0.15
    if (guest.prefersTrees) score *= 1 + def.treeCoverage * 0.15
    // long lap chains are slightly less attractive
    score *= 1 - plan.length * 0.06
    // word gets around about lines that climb back uphill
    score *= Math.max(0.12, 1 - (def.uphillFraction ?? 0) * 2.2)
    // look one hop ahead: a green road that strands you above black-only
    // terrain is a trap, and novices know to ask
    const bottom = getNode(state, def.bottomNodeId)
    if (bottom && !bottom.isBase) {
      const onward = lineOptionsAt(state, def.bottomNodeId, trail.trailId)
      if (onward.length > 0) {
        const bestOnwardFit = Math.max(
          ...onward.map((o) => difficultyFit(guest.skill, getTrailDef(state, o.trailId).difficulty, guest.riskTolerance)),
        )
        if (bestOnwardFit <= 0.05) score *= 0.12
      }
    }

    options.push({ trailId: trail.trailId, liftPlan: plan, score })
  }

  if (options.length === 0) return null
  options.sort((a, b) => b.score - a.score)
  if (options[0].score <= 0.08) return null
  // Weighted pick across every option in reach of the best (score² sharpens
  // toward quality) — the whole mountain gets skied, not just the one
  // top-scoring run. Stateless hash keeps it deterministic without touching
  // the sim's RNG stream.
  const pool = options.filter((o) => o.score > Math.max(0.08, options[0].score * 0.35))
  const total = pool.reduce((s, o) => s + o.score * o.score, 0)
  let r = hashNoise(state.seed, guest.id * 131 + Math.floor(state.minute * 4), 97) * total
  for (const o of pool) {
    r -= o.score * o.score
    if (r <= 0) return o
  }
  return pool[pool.length - 1]
}

export function estimatedWait(state: GameState, liftId: string): number {
  const lift = state.lifts[liftId]
  if (!lift) return 99
  const perMin = liftPerMinuteCapacity(lift.kind)
  return lift.queue.length / Math.max(1, perMin)
}

function liftPerMinuteCapacity(kind: string): number {
  const caps: Record<string, number> = { surface: 10, chair: 20, 'high-speed-chair': 40, gondola: 46 }
  return caps[kind] ?? 15
}

/** BFS through running lifts from a node to a target node. Returns lift id sequence or null. */
export function planLifts(state: GameState, fromNodeId: string, toNodeId: string): string[] | null {
  if (fromNodeId === toNodeId) return []
  const running = runningLifts(state)
  // base areas are interconnected on foot
  // guests stroll freely between all base-area stations
  const startNodes = getNode(state, fromNodeId)?.isBase
    ? allNodes(state).filter((n) => n.isBase).map((n) => n.id)
    : [fromNodeId]
  const visited = new Set(startNodes)
  const queue: { node: string; path: string[] }[] = startNodes.map((n) => ({ node: n, path: [] }))
  while (queue.length > 0) {
    const cur = queue.shift()!
    for (const lift of running) {
      const site = getLiftSite(state, lift.siteId)
      if (site.bottomNodeId !== cur.node || visited.has(site.topNodeId)) continue
      const path = [...cur.path, lift.siteId]
      if (site.topNodeId === toNodeId) return path
      visited.add(site.topNodeId)
      queue.push({ node: site.topNodeId, path })
    }
  }
  return null
}

// ------------------------------------------------------------------ alerts

export function pushAlert(state: GameState, severity: 'info' | 'warning' | 'critical', text: string): void {
  state.alerts.push({ id: state.nextAlertId++, minute: state.minute, day: state.day, severity, text })
  if (state.alerts.length > 60) state.alerts.splice(0, state.alerts.length - 60)
}

// ------------------------------------------------------------------ utils

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
function clamp01(v: number): number {
  return clamp(v, 0, 1)
}
