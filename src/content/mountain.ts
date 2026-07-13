/**
 * The ACTIVE mountain. Every export that used to be Mount Alder's static
 * geometry is now a live binding rebuilt by `activateMountain`; the rest of
 * the codebase keeps importing NODES / TRAIL_MAP / … unchanged and always
 * sees the mountain the current GameState simulates. Call `ensureMountain`
 * with a state's mountainId at every sim/render entry point — it's a string
 * compare when nothing changed.
 *
 * World coordinates are a 1920×1200 "trail map" view: summit near the top,
 * base village at the bottom. 1 world unit ≈ 2 m horizontal.
 */
import type { FacilitySlotDef, LiftSiteDef, MountainDef, MountainNode, TrailDef, Vec2 } from '../game/types'
import { DEFAULT_MOUNTAIN_ID, MOUNTAIN_MAP } from './mountains'

export const WORLD_W = 1920
export const WORLD_H = 1200

// ------------------------------------------------------- active mountain

export let ACTIVE_MOUNTAIN: MountainDef = MOUNTAIN_MAP[DEFAULT_MOUNTAIN_ID]

export let NODES: MountainNode[] = []
export let NODE_MAP: Record<string, MountainNode> = {}
/** walkable flat connections between base areas */
export let WALK_EDGES: [string, string][] = []
export let LIFT_SITES: LiftSiteDef[] = []
export let LIFT_SITE_MAP: Record<string, LiftSiteDef> = {}
export let TRAILS: TrailDef[] = []
export let TRAIL_MAP: Record<string, TrailDef> = {}
/** trails that come already cut and open on day 1 */
export let PREBUILT_TRAILS: string[] = []
export let FACILITY_SLOTS: FacilitySlotDef[] = []
export let SLOT_MAP: Record<string, FacilitySlotDef> = {}
export let TRAIL_PATHS: Record<string, MeasuredPath> = {}
export let LIFT_LINES: Record<string, MeasuredPath> = {}

export function activateMountain(def: MountainDef): void {
  ACTIVE_MOUNTAIN = def
  NODES = def.nodes
  NODE_MAP = Object.fromEntries(def.nodes.map((n) => [n.id, n]))
  WALK_EDGES = def.walkEdges
  LIFT_SITES = def.liftSites
  LIFT_SITE_MAP = Object.fromEntries(def.liftSites.map((s) => [s.id, s]))
  TRAILS = def.trails
  TRAIL_MAP = Object.fromEntries(def.trails.map((t) => [t.id, t]))
  PREBUILT_TRAILS = def.prebuiltTrails
  FACILITY_SLOTS = def.facilitySlots
  SLOT_MAP = Object.fromEntries(def.facilitySlots.map((s) => [s.id, s]))
  TRAIL_PATHS = Object.fromEntries(def.trails.map((t) => [t.id, measurePath(t.path)]))
  LIFT_LINES = Object.fromEntries(
    def.liftSites.map((s) => [s.id, measurePath([NODE_MAP[s.bottomNodeId].pos, NODE_MAP[s.topNodeId].pos])]),
  )
}

/** activate the mountain a state simulates — cheap no-op when unchanged */
export function ensureMountain(mountainId: string | undefined): void {
  const id = mountainId && MOUNTAIN_MAP[mountainId] ? mountainId : DEFAULT_MOUNTAIN_ID
  if (ACTIVE_MOUNTAIN.id !== id) activateMountain(MOUNTAIN_MAP[id])
}

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

/** trails on the upper mountain get an elevation snowfall bonus */
export function isUpperTrail(t: TrailDef): boolean {
  const m = ACTIVE_MOUNTAIN
  return NODE_MAP[t.topNodeId] !== undefined
    ? NODE_MAP[t.topNodeId].elevation >= m.baseElev + (m.topElev - m.baseElev) * 0.6
    : false
}

/** exposed = little tree cover; suffers wind stripping and wind-affected surface */
export function isExposedTrail(t: TrailDef): boolean {
  return t.treeCoverage < 0.3
}

// boot with the default mountain so imports are usable immediately
activateMountain(MOUNTAIN_MAP[DEFAULT_MOUNTAIN_ID])
