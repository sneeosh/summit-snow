/**
 * Domain models for Summit & Snow.
 *
 * Everything in GameState is plain serializable data — no class instances,
 * no functions — so save/load is JSON round-trip and the sim can run
 * headlessly (tests) without React or Pixi.
 */

export interface Vec2 {
  x: number
  y: number
}

// ---------------------------------------------------------------- terrain

export type SkillLevel = 'first-timer' | 'beginner' | 'intermediate' | 'advanced' | 'expert'

export type Difficulty = 'green' | 'blue' | 'black' | 'double-black'

export type SurfaceQuality =
  | 'fresh-powder'
  | 'packed-powder'
  | 'groomed'
  | 'firm'
  | 'icy'
  | 'thin'
  | 'wind-affected'

/** A named point on the mountain graph (base, junction, summit…). */
export interface MountainNode {
  id: string
  name: string
  pos: Vec2
  /** metres above sea level — drives snow line, wind exposure, rendering */
  elevation: number
  /** true for points guests can idle/walk at (base areas) */
  isBase: boolean
}

/** Static definition of a trail corridor (buildable or prebuilt). */
export interface TrailDef {
  id: string
  name: string
  difficulty: Difficulty
  topNodeId: string
  bottomNodeId: string
  /** polyline in world coords, top → bottom */
  path: Vec2[]
  lengthM: number
  verticalM: number
  widthM: number
  treeCoverage: number // 0..1
  scenicAppeal: number // 0..1
  /** baseline accident risk multiplier for the corridor */
  riskFactor: number
  /** cost to cut/open the corridor the first time; 0 = comes with the resort */
  buildCost: number
  /** max comfortable simultaneous skiers before crowding bites */
  capacity: number
  /** player-drawn trail (lives in GameState.customTrailDefs, not content) */
  isCustom?: boolean
  /** progress ranges where the line climbs back uphill — skiers get stuck */
  uphillSegments?: { t0: number; t1: number; climbM: number }[]
  uphillFraction?: number
  totalClimbM?: number
}

/**
 * A point where trails meet mid-mountain: crossings register a leg on each
 * trail (with progress t along its path); trails that start or end here
 * reference the junction through their top/bottomNodeId instead. Skiers
 * passing a junction may switch lines.
 */
export interface TrailJunction {
  /** the customNodes entry backing this junction on the network graph */
  nodeId: string
  /** trails passing through here, with world-length progress along each */
  legs: { trailId: string; t: number }[]
}

export type LiftKind = 'surface' | 'chair' | 'high-speed-chair' | 'gondola'

export interface LiftTypeSpec {
  kind: LiftKind
  label: string
  buildCost: number
  /** guests per hour */
  hourlyCapacity: number
  /** m/min travel speed along the line */
  speed: number
  /** chance per operating day of a mechanical fault (before maintenance staff) */
  faultChance: number
  /** lift closes when wind exceeds this (kph) */
  windTolerance: number
  maintenanceDaily: number
  staffRequired: number
  /** energy $ per operating hour */
  energyPerHour: number
}

/** A lift alignment guests can ride once built (surveyed or player-placed). */
export interface LiftSiteDef {
  id: string
  name: string
  bottomNodeId: string
  topNodeId: string
  allowedKinds: LiftKind[]
  /** prebuilt lifts start the scenario already constructed */
  prebuilt?: LiftKind
  /** player-placed point-to-point lift (lives in GameState.customLiftSites) */
  isCustom?: boolean
  /** what this alignment cost to build (custom lifts price by length + trees) */
  buildCost?: number
}

// ------------------------------------------------------------- facilities

export type FacilityKind =
  | 'ticket-office'
  | 'rental-shop'
  | 'ski-school'
  | 'base-lodge'
  | 'cafe'
  | 'restaurant'
  | 'restroom'
  | 'patrol-hq'
  | 'first-aid'
  | 'maintenance-garage'
  | 'parking'
  | 'pump-station'

export interface FacilitySpec {
  kind: FacilityKind
  label: string
  buildCost: number
  operatingDaily: number
  /** guests served simultaneously (where it applies) */
  capacity: number
  description: string
}

export interface FacilitySlotDef {
  id: string
  pos: Vec2
  /** slot flavour: village slots take any building; mountain slots are limited */
  allowed: FacilityKind[] | 'any-village'
  prebuilt?: FacilityKind
}

// -------------------------------------------------------------- mountains

export interface ClimateSpec {
  /** multiplies every storm's snowfall */
  snowfallMult: number
  /** °C added to daily highs/lows */
  tempOffset: number
  /** multiplies wind speeds */
  windMult: number
}

/** Authored landforms, shared by slope analysis, wind and the map painter. */
export interface Landform {
  name: string
  kind: 'ridge' | 'bowl' | 'meadow'
  center: Vec2
  radius: Vec2
  reliefM: number
  windMultiplier: number
}

export interface MountainIdentity {
  biome: 'hardwood' | 'birch' | 'tussock' | 'granite' | 'fir' | 'aspen' | 'limestone' | 'glacier'
  accent: string
  strategy: string
  development: string
  camera: { center: Vec2; width: number; height: number }
  landforms: Landform[]
}

/**
 * A purchasable mountain. All geometry shares the 1920×1200 world; character
 * comes from the skyline, the vertical (which drives how steep a drawn line
 * grades), climate, forest density, and the market it draws from.
 */
export interface MountainDef {
  id: string
  name: string
  /** where in the world it sits (and what real range inspired it) */
  region: string
  blurb: string
  identity?: MountainIdentity
  /** purchase price — also the sandbox buy-in */
  price: number
  /** metres at the base village (y=1040) */
  baseElev: number
  /** metres at the summit (y=ySummit) */
  topElev: number
  /** y of the highest skyline point; anchors the baseline elevation */
  ySummit: number
  /** the ridgeline silhouette, ascending x across the full world width */
  skyline: [number, number][]
  climate: ClimateSpec
  /** 0..1 forest thickness below the treeline — rainforest isn't cheap to clear */
  treeDensity: number
  /** metres — no trees grow above this; set below baseElev for treeless ranges */
  treelineElev: number
  /** per-skill multipliers on the visitor mix — powder meccas skew expert */
  clientele?: Partial<Record<SkillLevel, number>>
  /** baseline daily visitors (local market size) */
  baseDemand: number
  /** where guests walk in from */
  entrance: Vec2
  nodes: MountainNode[]
  walkEdges: [string, string][]
  liftSites: LiftSiteDef[]
  trails: TrailDef[]
  prebuiltTrails: string[]
  facilitySlots: FacilitySlotDef[]
}

/** a resort the company owns */
export interface Holding {
  mountainId: string
  pricePaid: number
  dayAcquired: number
}

export interface CompanyState {
  /** every owned resort, including the one being managed */
  holdings: Holding[]
  /** frozen sim states of owned, non-active resorts (their company is empty) */
  resortStates: Record<string, GameState>
}

// ---------------------------------------------------------------- weather

export interface WeatherDay {
  day: number
  tempHigh: number // °C at base
  tempLow: number
  snowfallCm: number // overnight + daytime total
  windKph: number
  visibility: number // 0..1
  cloud: number // 0..1
  summary: string
}

// ----------------------------------------------------------------- guests

export type GroupType = 'solo' | 'couple' | 'family' | 'friends' | 'school-group'

export type GuestObjective =
  | 'arriving'
  | 'buying-ticket'
  | 'renting'
  | 'walking' // moving between base points
  | 'to-lift'
  | 'queueing'
  | 'riding'
  | 'skiing'
  | 'eating'
  | 'restroom'
  | 'resting'
  | 'first-aid'
  | 'rescue'
  | 'leaving'
  | 'gone'

export interface GuestMemory {
  kind: string // e.g. 'long-line', 'powder-run', 'icy-trail', 'good-meal'
  text: string
  delta: number // satisfaction change it caused
  minute: number
}

export interface GuestVisit {
  goal: 'learn' | 'explore' | 'challenge' | 'relax'
  origin: 'day-trip' | 'inn' | 'shuttle'
  steps: { minute: number; label: string }[]
  lastActivity: string
  fulfilled: boolean
}

export interface Guest {
  visit?: GuestVisit

  id: number
  name: string
  skill: SkillLevel
  groupType: GroupType
  budget: number
  spent: number
  energy: number // 0..100, leaves when exhausted
  patience: number // 0..100 tolerance for queues
  satisfaction: number // 0..100
  riskTolerance: number // 0..1
  prefersTrees: boolean
  arrivalMinute: number
  hasTicket: boolean
  needsRental: boolean
  hasRental: boolean
  hunger: number // 0..100 grows during the day
  bladder: number // 0..100
  warmth: number // 100 = toasty, drains outside in cold
  objective: GuestObjective
  /** current world position (render + interaction) */
  pos: Vec2
  /** node the guest is at (when idle at a node) */
  atNodeId: string | null
  /** movement along a lift or trail */
  routeLiftId: string | null
  routeTrailId: string | null
  /** 0..1 progress along current lift/trail/walk segment */
  progress: number
  walkTarget: Vec2 | null
  /** remaining minutes occupied at a facility */
  busyMinutes: number
  facilityKind: FacilityKind | null
  /** planned sequence of lift ids to reach a trail top */
  plan: string[]
  plannedTrailId: string | null
  runsCompleted: number
  memories: GuestMemory[]
  injured: boolean
  /** minutes spent in the current lift queue */
  queuedMinutes: number
  lastTrailId: string | null
  hadLesson: boolean
  noFoodComplained: boolean
  noRestroomComplained: boolean
  isChild: boolean
  /** menu price at the venue the guest is heading to */
  venuePrice: number
  /** index of the uphill segment the guest is currently slogging through (-1 = none) */
  stuckSegIdx: number
}

// ------------------------------------------------------------------ lifts

export interface LiftState {
  siteId: string
  kind: LiftKind
  open: boolean
  /** closed by wind/breakdown regardless of player intent */
  forcedClosed: 'wind' | 'breakdown' | null
  breakdownMinutesLeft: number
  queue: number[] // guest ids in line
  /** fractional boarding allowance carried between ticks */
  boardCarry: number
  /** guests currently on the line, with their departure minute */
  riders: { guestId: number; boardedMinute: number }[]
  rideMinutes: number
  lengthM: number
  totalRidesToday: number
}

export interface TrailState {
  trailId: string
  built: boolean
  open: boolean
  snowDepthCm: number
  surface: SurfaceQuality
  groomedOvernight: boolean
  /** Auto joins the nightly queue; preserve leaves natural snow untouched. */
  groomingPolicy: 'auto' | 'preserve'
  hasSnowmaking: boolean
  skierIds: number[]
  ridesToday: number
  /** wear from traffic since last grooming, degrades surface */
  traffic: number
}

// ------------------------------------------------------------------ staff

export type StaffRole =
  | 'lift-ops'
  | 'patrol'
  | 'grooming'
  | 'snowmaking'
  | 'rental'
  | 'instructors'
  | 'food-service'
  | 'maintenance'

export interface StaffDept {
  role: StaffRole
  headcount: number
  dailyWage: number
}

// ---------------------------------------------------------------- economy

export interface Prices {
  adultTicket: number
  childTicket: number
  rental: number
  lesson: number
  /** 1 = value, 2 = standard, 3 = premium */
  foodLevel: number
  parking: number
}

export interface Loan {
  id: string
  label: string
  principal: number
  balance: number
  /** interest applied each morning */
  dailyRate: number
  dailyPayment: number
}

export interface RevenueBreakdown {
  tickets: number
  rentals: number
  food: number
  lessons: number
  parking: number
}

export interface RescueIncident {
  guestId: number
  trailId: string
  location: Vec2
  destination: Vec2
  injury: 'Serious fall' | 'Compound fracture'
  transport: 'sled' | 'helicopter'
  startedMinute: number
  responseMinutes: number
  completed: boolean
  cost: number
}

export interface ExpenseBreakdown {
  payroll: number
  maintenance: number
  energy: number
  facilities: number
  interest: number
  other: number
  /** Included in other; optional on historical reports. */
  medevac?: number
}

export interface DailyReport {
  day: number
  guestsServed: number
  peakGuests: number
  avgSatisfaction: number
  revenue: RevenueBreakdown
  expenses: ExpenseBreakdown
  netProfit: number
  compliments: { text: string; count: number }[]
  complaints: { text: string; count: number }[]
  reviews: { name: string; skill: SkillLevel; stars: number; text: string }[]
  incidents: number
  highlights: string[]
}

// ----------------------------------------------------------------- events

export type EventCategory = 'guest' | 'staff' | 'weather' | 'financial' | 'safety' | 'community'

export interface GameEffect {
  kind:
    | 'cash'
    | 'reputation'
    | 'demand-mult' // next-day demand multiplier
    | 'staff-morale'
    | 'close-trail'
    | 'close-lift'
    | 'satisfaction-all'
    | 'snow-bonus'
  amount: number
  targetId?: string
  /** days a temporary effect lasts */
  duration?: number
}

export interface EventChoice {
  id: string
  label: string
  description: string
  effects: GameEffect[]
}

export interface ResortEvent {
  id: string
  title: string
  category: EventCategory
  summary: string
  body: string
  choices: EventChoice[]
  /** sim day it disappears if unanswered */
  expiresDay: number
  resolved: boolean
  chosenId: string | null
  day: number
}

// ------------------------------------------------------------- objectives

export interface Objective {
  id: string
  label: string
  achieved: boolean
  progress: number // 0..1
  detail: string
}

// ------------------------------------------------------------- game state

export type GamePhase = 'planning' | 'operating' | 'day-end'

export type GameMode = 'scenario' | 'sandbox'

export interface Alert {
  id: number
  minute: number
  day: number
  severity: 'info' | 'warning' | 'critical'
  text: string
}

export type TownProject = 'inn' | 'housing' | 'shuttle' | 'mainstreet'
export type TownSeat = 'residents' | 'businesses' | 'conservation'
export type TownPolicy = 'winterMarket' | 'darkSky'
export interface TownMemory {
  label: string; day: number; season: number
  levels: Record<TownProject, number>; compactHomes: number
  policies: Record<TownPolicy, boolean>
}
export interface TownState {
  policies: Record<TownPolicy, boolean>
  scrapbook: TownMemory[]
  levels: Record<TownProject, number>
  trust: Record<TownSeat, number>
  compactHomes: number
  construction: { project: TownProject; homes: boolean; remainingDays: number; totalDays: number } | null
  lastOpening: { project: TownProject; level: number; day: number; season: number } | null
}

export interface GameState {
  recentVisits: { id: number; name: string; satisfaction: number; visit: GuestVisit }[]
  town: TownState
  version: number
  mode: GameMode
  seed: number
  /** which MountainDef this state simulates */
  mountainId: string
  /** Pins the geometry of existing resorts when authored mountains change. */
  mountainVersion: 1 | 2 | 3
  operations: { nightLighting: boolean; nightSkiing: boolean; avalancheClearedDay: number; avalancheClearedTrails: string[]; controlCostToday: number }
  /** the resort portfolio (only meaningful on the active state) */
  company: CompanyState
  /** monotonically increasing RNG draw counter — the whole sim shares one stream */
  rngState: number

  day: number // 1-based season day
  /** sandbox seasons roll over; scenario is a single-season story */
  season: number
  minute: number // minutes since 00:00, sim runs 8:30–16:30
  phase: GamePhase

  cash: number
  loans: Loan[]
  reputation: number // 0..5 stars
  staffMorale: number // 0..1

  prices: Prices
  staff: StaffDept[]

  lifts: Record<string, LiftState>
  trails: Record<string, TrailState>
  /** player-drawn trail definitions, keyed by trail id */
  customTrailDefs: Record<string, TrailDef>
  /** player-placed lift alignments, keyed by site id */
  customLiftSites: Record<string, LiftSiteDef>
  /** network points created by custom lift terminals and trail junctions, keyed by node id */
  customNodes: Record<string, MountainNode>
  /** where built trails cross or merge, keyed by the backing node id */
  junctions: Record<string, TrailJunction>
  facilities: Record<string, FacilityKind | null> // slotId -> built facility

  weatherSeason: WeatherDay[] // true weather for full season (forecast adds noise)

  guests: Record<number, Guest>
  nextGuestId: number
  departedToday: { satisfaction: number; name: string; skill: SkillLevel; memories: GuestMemory[]; spent: number }[]
  guestsArrivedToday: number
  peakGuestsToday: number

  /** accumulated during the operating day */
  revenueToday: RevenueBreakdown
  incidentsToday: number
  rescuesToday: RescueIncident[]

  demandMultTomorrow: number
  snowBonusCm: number
  /** expected visitors computed each morning; paces arrivals */
  targetDemandToday: number
  /** fractional arrivals carried between ticks */
  arrivalCarry: number

  events: ResortEvent[]
  alerts: Alert[]
  nextAlertId: number

  reports: DailyReport[]
  objectives: Objective[]
  scenarioComplete: boolean
  gameOver: boolean

  /** ids of tutorial steps already completed */
  tutorialDone: string[]
  tutorialActive: boolean

  totalGuestsSeason: number
  bestDayGuests: number
  seasonIncidents: number
}
