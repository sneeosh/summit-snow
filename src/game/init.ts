/** New-game state construction for scenario and sandbox modes. */
import {
  DAY_START_MIN,
  DEFAULT_PRICES,
  LIFT_TYPES,
  STARTING_CASH_SANDBOX,
  STARTING_CASH_SCENARIO,
  STARTING_DEPTH_RANGE,
  STARTING_REPUTATION,
  STARTING_STAFF,
  STAFF_WAGES,
  TRAIL_MIN_DEPTH_CM,
} from '../content/balance'
import {
  ensureMountain,
  FACILITY_SLOTS,
  LIFT_SITES,
  liftLengthM,
  PREBUILT_TRAILS,
  TRAIL_MAP as TRAIL_MAP_LOOKUP,
  TRAILS,
} from '../content/mountain'
import { DEFAULT_MOUNTAIN_ID, MOUNTAIN_MAP } from '../content/mountains'
import { Rng } from './rng'
import { computeSurface, generateSeasonWeather } from './weather'
import type { GameMode, GameState, LiftState, StaffRole, TrailState } from './types'

import { newTown } from './town'

export const SAVE_VERSION = 14

export function newGame(mode: GameMode, seed: number, mountainId: string = DEFAULT_MOUNTAIN_ID): GameState {
  // scenario is Mount Alder's story; sandbox roams the world
  const mountain = mode === 'scenario' ? MOUNTAIN_MAP[DEFAULT_MOUNTAIN_ID] : (MOUNTAIN_MAP[mountainId] ?? MOUNTAIN_MAP[DEFAULT_MOUNTAIN_ID])
  ensureMountain(mountain.id)
  const rng = new Rng(seed)
  const weatherSeason = generateSeasonWeather(seed, mountain.climate)
  // snow-starved hills open leaner, powder factories open deeper
  const depthScale = 0.7 + 0.3 * mountain.climate.snowfallMult

  // Both modes start with just the prebuilt lift — in sandbox, money is the
  // lever, not a pre-developed mountain.
  const lifts: Record<string, LiftState> = {}
  for (const site of LIFT_SITES) {
    if (site.prebuilt) {
      lifts[site.id] = makeLiftState(site.id, site.prebuilt)
    }
  }

  const trails: Record<string, TrailState> = {}
  for (const t of TRAILS) {
    const built = PREBUILT_TRAILS.includes(t.id)
    const state: TrailState = {
      trailId: t.id,
      built,
      open: false,
      snowDepthCm: Math.round(rng.range(STARTING_DEPTH_RANGE[0], STARTING_DEPTH_RANGE[1]) * depthScale),
      surface: 'packed-powder',
      groomedOvernight: built,
      groomingPolicy: 'auto',
      hasSnowmaking: false,
      skierIds: [],
      ridesToday: 0,
      traffic: 0,
    }
    state.surface = computeSurface(state, weatherSeason[0], (id) => TRAIL_MAP_LOOKUP[id])
    state.open = built && state.snowDepthCm >= TRAIL_MIN_DEPTH_CM
    trails[t.id] = state
  }

  const facilities: Record<string, ReturnType<typeof prebuiltFor>> = {}
  for (const slot of FACILITY_SLOTS) facilities[slot.id] = prebuiltFor(slot.id)

  const staff = (Object.keys(STAFF_WAGES) as StaffRole[]).map((role) => ({
    role,
    headcount: STARTING_STAFF[role],
    dailyWage: STAFF_WAGES[role],
  }))

  // sandbox pays the purchase price out of starting capital; the scenario's
  // family hill comes with the story
  const purchasePrice = mode === 'sandbox' ? mountain.price : 0

  return {
    version: SAVE_VERSION,
    town: newTown(),
    recentVisits: [],
    style: { name: '', color: '', decor: 'natural', trailNames: {}, liftNames: {} },
    hostedEvents: [], postcards: [],
    mode,
    seed,
    mountainId: mountain.id,
    mountainVersion: 3,
    operations: { nightLighting: false, nightSkiing: false, avalancheClearedDay: 0, avalancheClearedTrails: [], controlCostToday: 0 },
    company: {
      holdings: [{ mountainId: mountain.id, pricePaid: purchasePrice, dayAcquired: 1 }],
      resortStates: {},
    },
    rngState: rng.state,
    day: 1,
    season: 1,
    minute: DAY_START_MIN,
    phase: 'planning',
    cash: mode === 'sandbox' ? STARTING_CASH_SANDBOX - purchasePrice : STARTING_CASH_SCENARIO,
    loans: [],
    reputation: STARTING_REPUTATION,
    staffMorale: 0.75,
    prices: { ...DEFAULT_PRICES },
    staff,
    lifts,
    trails,
    customTrailDefs: {},
    customLiftSites: {},
    customNodes: {},
    junctions: {},
    facilities,
    weatherSeason,
    guests: {},
    nextGuestId: 1,
    departedToday: [],
    guestsArrivedToday: 0,
    peakGuestsToday: 0,
    revenueToday: { tickets: 0, rentals: 0, food: 0, lessons: 0, parking: 0 },
    incidentsToday: 0,
    rescuesToday: [],
    demandMultTomorrow: 1,
    snowBonusCm: 0,
    targetDemandToday: 0,
    arrivalCarry: 0,
    events: [],
    alerts: [],
    nextAlertId: 1,
    reports: [],
    objectives: makeObjectives(mode),
    scenarioComplete: false,
    gameOver: false,
    tutorialDone: [],
    // first-timers need the nudges in sandbox too; it's skippable either way
    tutorialActive: true,
    totalGuestsSeason: 0,
    bestDayGuests: 0,
    seasonIncidents: 0,
  }
}

export function makeLiftState(siteId: string, kind: LiftState['kind'], customLengthM?: number): LiftState {
  const lengthM = customLengthM ?? liftLengthM(LIFT_SITES.find((s) => s.id === siteId)!)
  return {
    siteId,
    kind,
    open: false,
    forcedClosed: null,
    breakdownMinutesLeft: 0,
    queue: [],
    boardCarry: 0,
    riders: [],
    rideMinutes: Math.max(1, Math.round((lengthM / LIFT_TYPES[kind].speed) * 10) / 10),
    lengthM,
    totalRidesToday: 0,
  }
}

function prebuiltFor(slotId: string) {
  return FACILITY_SLOTS.find((s) => s.id === slotId)?.prebuilt ?? null
}

function makeObjectives(mode: GameMode) {
  if (mode !== 'scenario') return []
  return [
    {
      id: 'satisfaction',
      label: 'Reach 65% average guest satisfaction in a day',
      achieved: false,
      progress: 0,
      detail: 'Best day so far: —',
    },
    {
      id: 'guests',
      label: 'Serve 250 guests in one day',
      achieved: false,
      progress: 0,
      detail: 'Best day so far: 0',
    },
    {
      id: 'profit',
      label: 'Finish a day with positive operating profit',
      achieved: false,
      progress: 0,
      detail: 'Yet to break even',
    },
    {
      id: 'blue-trail',
      label: 'Open an intermediate trail',
      achieved: false,
      progress: 0,
      detail: 'Cut Alder Run or North Ridge',
    },
    {
      id: 'safety',
      label: 'Keep serious incidents under 5 all season',
      achieved: true, // holds until broken
      progress: 1,
      detail: '0 serious incidents',
    },
  ]
}
