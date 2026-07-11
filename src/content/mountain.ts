/**
 * Mount Alder — the fictional mountain. All static geometry: nodes, lift
 * alignments, trail corridors, facility slots. World coordinates are a
 * 1920×1200 "trail map" view: summit near the top, base village at the
 * bottom. 1 world unit ≈ 2 m horizontal.
 */
import type { FacilitySlotDef, LiftSiteDef, MountainNode, TrailDef, Vec2 } from '../game/types'

export const WORLD_W = 1920
export const WORLD_H = 1200

export const NODES: MountainNode[] = [
  { id: 'summit', name: 'Alder Summit', pos: { x: 940, y: 170 }, elevation: 2350, isBase: false },
  { id: 'north-ridge', name: 'North Ridge', pos: { x: 1370, y: 330 }, elevation: 2080, isBase: false },
  { id: 'mid', name: 'Mid Station', pos: { x: 800, y: 560 }, elevation: 1720, isBase: false },
  { id: 'beginner-top', name: 'Meadow Knoll', pos: { x: 470, y: 820 }, elevation: 1420, isBase: false },
  { id: 'beginner-base', name: 'Meadow Base', pos: { x: 560, y: 1010 }, elevation: 1265, isBase: true },
  { id: 'base', name: 'Base Village', pos: { x: 950, y: 1040 }, elevation: 1250, isBase: true },
]

export const NODE_MAP: Record<string, MountainNode> = Object.fromEntries(NODES.map((n) => [n.id, n]))

/** walkable flat connections between base areas */
export const WALK_EDGES: [string, string][] = [['beginner-base', 'base']]

export const LIFT_SITES: LiftSiteDef[] = [
  {
    id: 'meadow-carpet',
    name: 'Meadow Carpet',
    bottomNodeId: 'beginner-base',
    topNodeId: 'beginner-top',
    allowedKinds: ['surface'],
    prebuilt: 'surface',
  },
  {
    id: 'alder-chair',
    name: 'Alder Chair',
    bottomNodeId: 'base',
    topNodeId: 'mid',
    allowedKinds: ['chair', 'high-speed-chair'],
  },
  {
    id: 'ridge-express',
    name: 'North Ridge Express',
    bottomNodeId: 'mid',
    topNodeId: 'north-ridge',
    allowedKinds: ['chair', 'high-speed-chair'],
  },
  {
    id: 'timber-chair',
    name: 'Timber Chair',
    bottomNodeId: 'mid',
    topNodeId: 'summit',
    allowedKinds: ['chair', 'high-speed-chair'],
  },
  {
    id: 'summit-gondola',
    name: 'Summit Gondola',
    bottomNodeId: 'base',
    topNodeId: 'summit',
    allowedKinds: ['gondola'],
  },
]

export const LIFT_SITE_MAP: Record<string, LiftSiteDef> = Object.fromEntries(LIFT_SITES.map((s) => [s.id, s]))

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** slope length in metres for a lift site (horizontal scale + vertical rise) */
export function liftLengthM(site: LiftSiteDef): number {
  const a = NODE_MAP[site.bottomNodeId]
  const b = NODE_MAP[site.topNodeId]
  const horiz = dist(a.pos, b.pos) * 2
  const vert = b.elevation - a.elevation
  return Math.round(Math.hypot(horiz, vert))
}

export const TRAILS: TrailDef[] = [
  {
    id: 'bunny-hollow',
    name: 'Bunny Hollow',
    difficulty: 'green',
    topNodeId: 'beginner-top',
    bottomNodeId: 'beginner-base',
    path: [
      { x: 470, y: 820 },
      { x: 430, y: 900 },
      { x: 480, y: 965 },
      { x: 560, y: 1010 },
    ],
    lengthM: 620,
    verticalM: 155,
    widthM: 45,
    treeCoverage: 0.1,
    scenicAppeal: 0.45,
    riskFactor: 0.7,
    buildCost: 0,
    capacity: 60,
  },
  {
    id: 'pinecone-way',
    name: 'Pinecone Way',
    difficulty: 'green',
    topNodeId: 'beginner-top',
    bottomNodeId: 'base',
    path: [
      { x: 470, y: 820 },
      { x: 560, y: 880 },
      { x: 660, y: 920 },
      { x: 760, y: 980 },
      { x: 870, y: 1020 },
      { x: 950, y: 1040 },
    ],
    lengthM: 1450,
    verticalM: 170,
    widthM: 30,
    treeCoverage: 0.55,
    scenicAppeal: 0.7,
    riskFactor: 0.85,
    buildCost: 0,
    capacity: 70,
  },
  {
    id: 'alder-run',
    name: 'Alder Run',
    difficulty: 'blue',
    topNodeId: 'mid',
    bottomNodeId: 'base',
    path: [
      { x: 800, y: 560 },
      { x: 740, y: 680 },
      { x: 790, y: 800 },
      { x: 880, y: 920 },
      { x: 950, y: 1040 },
    ],
    lengthM: 1750,
    verticalM: 470,
    widthM: 35,
    treeCoverage: 0.35,
    scenicAppeal: 0.6,
    riskFactor: 1,
    buildCost: 18_000,
    capacity: 80,
  },
  {
    id: 'north-ridge-run',
    name: 'North Ridge',
    difficulty: 'blue',
    topNodeId: 'north-ridge',
    bottomNodeId: 'base',
    path: [
      { x: 1370, y: 330 },
      { x: 1430, y: 480 },
      { x: 1380, y: 640 },
      { x: 1280, y: 800 },
      { x: 1130, y: 950 },
      { x: 950, y: 1040 },
    ],
    lengthM: 2600,
    verticalM: 830,
    widthM: 32,
    treeCoverage: 0.25,
    scenicAppeal: 0.9,
    riskFactor: 1.05,
    buildCost: 25_000,
    capacity: 95,
  },
  {
    id: 'timberline',
    name: 'Timberline',
    difficulty: 'black',
    topNodeId: 'summit',
    bottomNodeId: 'mid',
    path: [
      { x: 940, y: 170 },
      { x: 870, y: 300 },
      { x: 900, y: 420 },
      { x: 830, y: 500 },
      { x: 800, y: 560 },
    ],
    lengthM: 1350,
    verticalM: 630,
    widthM: 22,
    treeCoverage: 0.7,
    scenicAppeal: 0.75,
    riskFactor: 1.4,
    buildCost: 30_000,
    capacity: 45,
  },
  {
    id: 'avalanche-chute',
    name: 'Avalanche Chute',
    difficulty: 'double-black',
    topNodeId: 'summit',
    bottomNodeId: 'north-ridge',
    path: [
      { x: 940, y: 170 },
      { x: 1060, y: 220 },
      { x: 1180, y: 250 },
      { x: 1290, y: 300 },
      { x: 1370, y: 330 },
    ],
    lengthM: 950,
    verticalM: 270,
    widthM: 14,
    treeCoverage: 0.15,
    scenicAppeal: 0.85,
    riskFactor: 2.1,
    buildCost: 20_000,
    capacity: 25,
  },
]

export const TRAIL_MAP: Record<string, TrailDef> = Object.fromEntries(TRAILS.map((t) => [t.id, t]))

/** trails that come already cut and open on day 1 */
export const PREBUILT_TRAILS = ['bunny-hollow', 'pinecone-way']

export const FACILITY_SLOTS: FacilitySlotDef[] = [
  { id: 'v1', pos: { x: 1010, y: 1092 }, allowed: 'any-village', prebuilt: 'base-lodge' },
  { id: 'v2', pos: { x: 905, y: 1085 }, allowed: 'any-village', prebuilt: 'ticket-office' },
  { id: 'v3', pos: { x: 812, y: 1098 }, allowed: 'any-village' },
  { id: 'v4', pos: { x: 1115, y: 1085 }, allowed: 'any-village' },
  { id: 'v5', pos: { x: 1212, y: 1098 }, allowed: 'any-village' },
  { id: 'v6', pos: { x: 715, y: 1110 }, allowed: 'any-village' },
  { id: 'v7', pos: { x: 1305, y: 1115 }, allowed: 'any-village' },
  { id: 'v8', pos: { x: 618, y: 1096 }, allowed: 'any-village' },
  { id: 'p1', pos: { x: 1430, y: 1140 }, allowed: ['parking'], prebuilt: 'parking' },
  { id: 'p2', pos: { x: 1530, y: 1152 }, allowed: ['parking'] },
  { id: 'm1', pos: { x: 862, y: 545 }, allowed: ['cafe', 'restroom', 'first-aid'] },
]

export const SLOT_MAP: Record<string, FacilitySlotDef> = Object.fromEntries(FACILITY_SLOTS.map((s) => [s.id, s]))

// ---------------------------------------------------------- path helpers

export interface MeasuredPath {
  points: Vec2[]
  /** cumulative world-length at each point, [0] = 0 */
  cum: number[]
  total: number
}

export function measurePath(points: Vec2[]): MeasuredPath {
  const cum = [0]
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + dist(points[i - 1], points[i]))
  }
  return { points, cum, total: cum[cum.length - 1] }
}

/** position along a measured path at t ∈ [0,1] */
export function pointAt(mp: MeasuredPath, t: number): Vec2 {
  const target = Math.max(0, Math.min(1, t)) * mp.total
  for (let i = 1; i < mp.points.length; i++) {
    if (mp.cum[i] >= target) {
      const segLen = mp.cum[i] - mp.cum[i - 1]
      const f = segLen === 0 ? 0 : (target - mp.cum[i - 1]) / segLen
      return {
        x: mp.points[i - 1].x + (mp.points[i].x - mp.points[i - 1].x) * f,
        y: mp.points[i - 1].y + (mp.points[i].y - mp.points[i - 1].y) * f,
      }
    }
  }
  return mp.points[mp.points.length - 1]
}

export const TRAIL_PATHS: Record<string, MeasuredPath> = Object.fromEntries(
  TRAILS.map((t) => [t.id, measurePath(t.path)]),
)

export const LIFT_LINES: Record<string, MeasuredPath> = Object.fromEntries(
  LIFT_SITES.map((s) => [s.id, measurePath([NODE_MAP[s.bottomNodeId].pos, NODE_MAP[s.topNodeId].pos])]),
)

/** trails on the upper mountain get an elevation snowfall bonus */
export function isUpperTrail(t: TrailDef): boolean {
  return NODE_MAP[t.topNodeId].elevation >= 2000
}

/** exposed = little tree cover; suffers wind stripping and wind-affected surface */
export function isExposedTrail(t: TrailDef): boolean {
  return t.treeCoverage < 0.3
}
