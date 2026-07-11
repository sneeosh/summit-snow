/**
 * Every tunable number in one place. If a designer might want to change it,
 * it lives here, not inline in a system.
 */
import type { FacilityKind, FacilitySpec, LiftKind, LiftTypeSpec, Prices, SkillLevel, StaffRole } from '../game/types'

// ------------------------------------------------------------------- time

export const DAY_START_MIN = 8 * 60 + 30 // 08:30
export const DAY_END_MIN = 16 * 60 + 30 // 16:30
export const LAST_ARRIVAL_MIN = 14 * 60 // gates close 14:00
/** sim minutes advanced per tick */
export const TICK_MINUTES = 0.25
/** real milliseconds per tick at 1× speed (day ≈ 7 min real time) */
export const TICK_REAL_MS = 220
export const SEASON_DAYS = 60

// ------------------------------------------------------------------ money

export const STARTING_CASH_SCENARIO = 80_000
export const STARTING_CASH_SANDBOX = 500_000
export const STARTING_REPUTATION = 2.5

export const DEFAULT_PRICES: Prices = {
  adultTicket: 59,
  childTicket: 39,
  rental: 32,
  lesson: 75,
  foodLevel: 2,
  parking: 8,
}

/** demand elasticity reference point for adult ticket price */
export const TICKET_REFERENCE_PRICE = 55

export const LOAN_OFFERS = [
  { id: 'operating', label: 'Operating loan', principal: 25_000, dailyRate: 0.0007, dailyPayment: 450 },
  { id: 'expansion', label: 'Expansion loan', principal: 120_000, dailyRate: 0.0006, dailyPayment: 1_800 },
] as const

// ------------------------------------------------------------------ lifts

export const LIFT_TYPES: Record<LiftKind, LiftTypeSpec> = {
  surface: {
    kind: 'surface',
    label: 'Surface lift',
    buildCost: 15_000,
    hourlyCapacity: 600,
    speed: 120,
    faultChance: 0.03,
    windTolerance: 70,
    maintenanceDaily: 90,
    staffRequired: 1,
    energyPerHour: 6,
  },
  chair: {
    kind: 'chair',
    label: 'Fixed-grip chairlift',
    buildCost: 55_000,
    hourlyCapacity: 1_200,
    speed: 150,
    faultChance: 0.05,
    windTolerance: 55,
    maintenanceDaily: 220,
    staffRequired: 2,
    energyPerHour: 14,
  },
  'high-speed-chair': {
    kind: 'high-speed-chair',
    label: 'High-speed chair',
    buildCost: 140_000,
    hourlyCapacity: 2_400,
    speed: 300,
    faultChance: 0.06,
    windTolerance: 50,
    maintenanceDaily: 420,
    staffRequired: 3,
    energyPerHour: 30,
  },
  gondola: {
    kind: 'gondola',
    label: 'Gondola',
    buildCost: 320_000,
    hourlyCapacity: 2_800,
    speed: 360,
    faultChance: 0.05,
    windTolerance: 80,
    maintenanceDaily: 650,
    staffRequired: 4,
    energyPerHour: 45,
  },
}

// ------------------------------------------------------------- facilities

export const FACILITIES: Record<FacilityKind, FacilitySpec> = {
  'ticket-office': {
    kind: 'ticket-office',
    label: 'Ticket office',
    buildCost: 8_000,
    operatingDaily: 60,
    capacity: 6,
    description: 'Sells lift tickets. More windows, shorter morning lines.',
  },
  'rental-shop': {
    kind: 'rental-shop',
    label: 'Rental shop',
    buildCost: 20_000,
    operatingDaily: 120,
    capacity: 8,
    description: 'Rents skis and boards to the roughly half of guests who need gear.',
  },
  'ski-school': {
    kind: 'ski-school',
    label: 'Ski school',
    buildCost: 15_000,
    operatingDaily: 80,
    capacity: 10,
    description: 'Lessons for first-timers and beginners. Needs instructors.',
  },
  'base-lodge': {
    kind: 'base-lodge',
    label: 'Base lodge',
    buildCost: 60_000,
    operatingDaily: 200,
    capacity: 60,
    description: 'Warmth, rest, and a place to regroup. The heart of the village.',
  },
  cafe: {
    kind: 'cafe',
    label: 'Café',
    buildCost: 18_000,
    operatingDaily: 90,
    capacity: 20,
    description: 'Quick coffee, chili, and waffles. Solid margins.',
  },
  restaurant: {
    kind: 'restaurant',
    label: 'Restaurant',
    buildCost: 45_000,
    operatingDaily: 220,
    capacity: 32,
    description: 'Full table service. Higher spend, needs food staff.',
  },
  restroom: {
    kind: 'restroom',
    label: 'Restroom building',
    buildCost: 6_000,
    operatingDaily: 30,
    capacity: 10,
    description: 'Underrated. Guests remember when there isn’t one.',
  },
  'patrol-hq': {
    kind: 'patrol-hq',
    label: 'Ski patrol HQ',
    buildCost: 14_000,
    operatingDaily: 70,
    capacity: 0,
    description: 'Boosts patrol effectiveness and incident response.',
  },
  'first-aid': {
    kind: 'first-aid',
    label: 'First aid clinic',
    buildCost: 12_000,
    operatingDaily: 60,
    capacity: 6,
    description: 'Treats injuries on-site, softening reputation damage.',
  },
  'maintenance-garage': {
    kind: 'maintenance-garage',
    label: 'Maintenance garage',
    buildCost: 22_000,
    operatingDaily: 80,
    capacity: 0,
    description: 'Halves lift breakdown odds; faster repairs.',
  },
  parking: {
    kind: 'parking',
    label: 'Parking expansion',
    buildCost: 10_000,
    operatingDaily: 40,
    capacity: 0,
    description: 'Each lot raises the daily visitor ceiling by 150.',
  },
  'pump-station': {
    kind: 'pump-station',
    label: 'Snowmaking pump station',
    buildCost: 30_000,
    operatingDaily: 110,
    capacity: 0,
    description: 'Boosts snow gun output and lets techs cover more trails.',
  },
}

// ---- custom (player-drawn) trails
export const CUSTOM_TRAIL_WIDTH_M = 28
/** groundwork per metre of trail cut */
export const TRAIL_COST_PER_M = 8
/** felling + hauling one tree out of the corridor */
export const TREE_CLEAR_COST = 180
export const CUSTOM_TRAIL_NAMES_FALLBACK = 'Line'

export const SNOWMAKING_INSTALL_COST = 12_000
export const SNOWMAKING_ENERGY_PER_NIGHT = 220
export const SNOWMAKING_CM_PER_NIGHT = 8
export const SNOWMAKING_MAX_TEMP = -3 // needs at least this cold (tempLow)
export const PUMP_STATION_MULT = 1.6
/** trails one snowmaking tech can run guns on per night */
export const TRAILS_PER_SNOW_TECH = 2
/** trails one groomer op can groom per night */
export const TRAILS_PER_GROOMER = 2

// ------------------------------------------------------------------ staff

export const STAFF_WAGES: Record<StaffRole, number> = {
  'lift-ops': 140,
  patrol: 180,
  grooming: 200,
  snowmaking: 170,
  rental: 120,
  instructors: 160,
  'food-service': 110,
  maintenance: 150,
}

export const STARTING_STAFF: Record<StaffRole, number> = {
  'lift-ops': 2,
  patrol: 2,
  grooming: 1,
  snowmaking: 0,
  rental: 0,
  instructors: 0,
  'food-service': 1,
  maintenance: 0,
}

/** rental guests one rental employee can serve per hour */
export const RENTAL_GUESTS_PER_STAFF_HOUR = 15
/** lessons one instructor teaches per day */
export const LESSONS_PER_INSTRUCTOR = 6
/** open trails one patroller can reasonably cover */
export const TRAILS_PER_PATROLLER = 2

// ----------------------------------------------------------------- guests

export const BASE_DEMAND = 150
export const WEEKEND_MULT = 1.55
/** each parking facility (incl. the prebuilt lot) supports this many guests/day */
export const GUESTS_PER_PARKING = 150
export const MAX_LIVE_GUESTS = 700

export const SKILL_DISTRIBUTION: { item: SkillLevel; weight: number }[] = [
  { item: 'first-timer', weight: 0.14 },
  { item: 'beginner', weight: 0.26 },
  { item: 'intermediate', weight: 0.34 },
  { item: 'advanced', weight: 0.19 },
  { item: 'expert', weight: 0.07 },
]

/** m/min skiing speed by skill (scaled by surface) */
export const SKI_SPEED: Record<SkillLevel, number> = {
  'first-timer': 140,
  beginner: 200,
  intermediate: 320,
  advanced: 430,
  expert: 520,
}

export const WALK_SPEED = 55 // m/min between base areas

export const GUEST_START_SATISFACTION = 68
export const CHILD_FRACTION = 0.28 // of guests pay child price
export const RENTAL_NEED_FRACTION = 0.45

/** minutes of queueing a guest tolerates before it starts to hurt, scaled by patience */
export const QUEUE_GRACE_MIN = 6

export const HUNGER_PER_MIN = 0.22
export const BLADDER_PER_MIN = 0.16
export const ENERGY_DRAIN_SKI_PER_MIN = 0.5
export const ENERGY_DRAIN_IDLE_PER_MIN = 0.06
export const WARMTH_DRAIN_BASE = 0.18 // per min outside at 0°C, grows when colder

// --------------------------------------------------------------- incidents

export const INCIDENT_BASE_RISK_PER_MIN = 0.00006
export const INCIDENT_DIFFICULTY_MULT = { green: 0.5, blue: 1, black: 1.9, 'double-black': 2.8 } as const
export const INCIDENT_SURFACE_MULT: Record<string, number> = {
  icy: 2.1,
  firm: 1.25,
  'wind-affected': 1.5,
  thin: 1.6,
  'fresh-powder': 0.8,
  'packed-powder': 0.9,
  groomed: 0.85,
}

// ----------------------------------------------------------------- energy

export const ENERGY_COST_LIGHTS_DAILY = 45 // village baseline

// ------------------------------------------------------------------- snow

export const TRAIL_MIN_DEPTH_CM = 20
export const STARTING_DEPTH_RANGE: [number, number] = [34, 55]
export const MELT_PER_DEGREE_ABOVE = 1.4 // cm per °C of tempHigh above +1
export const WIND_STRIP_CM = 3 // exposed trails in >45kph wind
export const ELEVATION_SNOW_BONUS = 0.35 // +35% snowfall on upper-mountain trails

// ------------------------------------------------------------- reputation

export const REPUTATION_SMOOTHING = 0.78 // old weight in nightly blend
export const SERIOUS_INCIDENT_REP_HIT = 0.12

// ------------------------------------------------------------- objectives

export const OBJ_SATISFACTION_TARGET = 65
export const OBJ_GUESTS_IN_DAY = 250
export const OBJ_MAX_SERIOUS_INCIDENTS = 5
