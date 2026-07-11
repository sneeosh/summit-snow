/**
 * Trails as a unified concept: the surveyed corridors from content plus
 * player-drawn custom trails living in GameState. Also the path analysis
 * that grades a drawn line — difficulty from gradient, uphill segments
 * where skiers will get stuck, endpoint snapping to the lift network —
 * and the costing that charges for groundwork and tree clearing.
 *
 * The game deliberately does NOT stop you from building a bad trail. The
 * analysis warns; the skiers judge.
 */
import {
  CUSTOM_TRAIL_NAMES_FALLBACK,
  CUSTOM_TRAIL_WIDTH_M,
  LIFT_BASE_COST,
  LIFT_CLEAR_WIDTH_M,
  LIFT_COST_PER_M,
  LIFT_MIN_RISE_M,
  TRAIL_COST_PER_M,
  TREE_CLEAR_COST,
} from '../content/balance'
import {
  LIFT_LINES,
  LIFT_SITE_MAP,
  measurePath,
  NODE_MAP,
  NODES,
  TRAIL_MAP,
  TRAIL_PATHS,
  type MeasuredPath,
} from '../content/mountain'
import { CUSTOM_TRAIL_NAMES } from '../content/names'
import { clearingHalfWidthWu, distToPath, elevationAt, skylineYAt, treesInCorridor } from './terrainModel'
import type { Difficulty, GameState, LiftKind, LiftSiteDef, MountainNode, TrailDef, Vec2 } from './types'

/** snap radius for attaching trail endpoints to network nodes (world units) */
export const NODE_SNAP_WU = 45

/** true when the point is on the mountain face — at or below the ridgeline */
export function isOnMountain(p: Vec2): boolean {
  return p.y >= skylineYAt(p.x) - 4 && p.x >= 0 && p.x <= 1920 && p.y <= 1200
}

// ------------------------------------------------------- network lookups

/** a network node: surveyed (content) or created by a custom lift terminal */
export function getNode(state: GameState, nodeId: string): MountainNode | undefined {
  return NODE_MAP[nodeId] ?? state.customNodes[nodeId]
}

export function allNodes(state: GameState): MountainNode[] {
  return [...NODES, ...Object.values(state.customNodes)]
}

export function getLiftSite(state: GameState, siteId: string): LiftSiteDef {
  return LIFT_SITE_MAP[siteId] ?? state.customLiftSites[siteId]
}

const liftLineCache = new WeakMap<LiftSiteDef, MeasuredPath>()

export function getLiftLine(state: GameState, siteId: string): MeasuredPath {
  const staticLine = LIFT_LINES[siteId]
  if (staticLine) return staticLine
  const site = state.customLiftSites[siteId]
  let mp = liftLineCache.get(site)
  if (!mp) {
    mp = measurePath([getNode(state, site.bottomNodeId)!.pos, getNode(state, site.topNodeId)!.pos])
    liftLineCache.set(site, mp)
  }
  return mp
}

/** slope length in metres for any lift site (horizontal scale + vertical rise) */
export function liftSlopeLengthM(state: GameState, site: LiftSiteDef): number {
  const a = getNode(state, site.bottomNodeId)!
  const b = getNode(state, site.topNodeId)!
  const horiz = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y) * 2
  return Math.round(Math.hypot(horiz, b.elevation - a.elevation))
}

// ----------------------------------------------------------- def lookups

export function getTrailDef(state: GameState, trailId: string): TrailDef {
  return TRAIL_MAP[trailId] ?? state.customTrailDefs[trailId]
}

export function allTrailDefs(state: GameState): TrailDef[] {
  return [...Object.values(TRAIL_MAP), ...Object.values(state.customTrailDefs)]
}

const pathCache = new WeakMap<TrailDef, MeasuredPath>()

export function getTrailPath(state: GameState, trailId: string): MeasuredPath {
  const staticPath = TRAIL_PATHS[trailId]
  if (staticPath) return staticPath
  const def = state.customTrailDefs[trailId]
  let mp = pathCache.get(def)
  if (!mp) {
    mp = measurePath(def.path)
    pathCache.set(def, mp)
  }
  return mp
}

// ------------------------------------------------------------- analysis

export interface UphillSegment {
  /** progress range along the path, 0..1 */
  t0: number
  t1: number
  climbM: number
}

export interface PathAnalysis {
  lengthM: number
  verticalM: number
  /** steepest sustained downhill gradient (rise/run) */
  steepest: number
  difficulty: Difficulty
  uphillSegments: UphillSegment[]
  uphillFraction: number
  totalClimbM: number
  topNodeId: string | null
  bottomNodeId: string | null
}

export function nearestNodeId(p: Vec2, radius = NODE_SNAP_WU, nodes: MountainNode[] = NODES): string | null {
  let best: string | null = null
  let bestD = radius
  for (const node of nodes) {
    const d = Math.hypot(node.pos.x - p.x, node.pos.y - p.y)
    if (d < bestD) {
      bestD = d
      best = node.id
    }
  }
  return best
}

export function analyzePath(points: Vec2[], nodes: MountainNode[] = NODES): PathAnalysis {
  const empty: PathAnalysis = {
    lengthM: 0,
    verticalM: 0,
    steepest: 0,
    difficulty: 'green',
    uphillSegments: [],
    uphillFraction: 0,
    totalClimbM: 0,
    topNodeId: points.length > 0 ? nearestNodeId(points[0], NODE_SNAP_WU, nodes) : null,
    bottomNodeId: points.length > 1 ? nearestNodeId(points[points.length - 1], NODE_SNAP_WU, nodes) : null,
  }
  if (points.length < 2) return empty

  let lengthM = 0
  let steepest = 0
  let totalClimbM = 0
  const segs: { lenM: number; dropM: number }[] = []
  for (let i = 1; i < points.length; i++) {
    const horizM = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y) * 2
    const dropM = elevationAt(points[i - 1]) - elevationAt(points[i]) // positive = descends
    const lenM = Math.hypot(horizM, dropM)
    segs.push({ lenM, dropM })
    lengthM += lenM
    if (horizM > 1 && dropM > 0) steepest = Math.max(steepest, dropM / horizM)
    if (dropM < 0) totalClimbM += -dropM
  }

  // uphill segments as progress ranges (merged when adjacent)
  const uphillSegments: UphillSegment[] = []
  let cum = 0
  for (const seg of segs) {
    if (seg.dropM < -0.5) {
      const t0 = cum / lengthM
      const t1 = (cum + seg.lenM) / lengthM
      const last = uphillSegments[uphillSegments.length - 1]
      if (last && t0 - last.t1 < 0.02) {
        last.t1 = t1
        last.climbM += -seg.dropM
      } else {
        uphillSegments.push({ t0, t1, climbM: -seg.dropM })
      }
    }
    cum += seg.lenM
  }
  const uphillLen = uphillSegments.reduce((s, u) => s + (u.t1 - u.t0), 0)

  const verticalM = Math.max(0, elevationAt(points[0]) - elevationAt(points[points.length - 1]))

  let difficulty: Difficulty = 'green'
  if (steepest >= 0.62) difficulty = 'double-black'
  else if (steepest >= 0.45) difficulty = 'black'
  else if (steepest >= 0.28) difficulty = 'blue'

  return {
    lengthM: Math.round(lengthM),
    verticalM: Math.round(verticalM),
    steepest: Math.round(steepest * 100) / 100,
    difficulty,
    uphillSegments,
    uphillFraction: Math.round(uphillLen * 1000) / 1000,
    totalClimbM: Math.round(totalClimbM),
    topNodeId: nearestNodeId(points[0], NODE_SNAP_WU, nodes),
    bottomNodeId: nearestNodeId(points[points.length - 1], NODE_SNAP_WU, nodes),
  }
}

// --------------------------------------------------------------- planning

export interface TrailPlan {
  analysis: PathAnalysis
  treesToClear: number
  groundworkCost: number
  clearingCost: number
  totalCost: number
  warnings: string[]
}

export function planCustomTrail(state: GameState, points: Vec2[]): TrailPlan {
  const analysis = analyzePath(points, allNodes(state))

  // trees in this corridor that aren't already cleared by an existing custom trail
  const inCorridor = points.length >= 2 ? treesInCorridor(state.seed, points, CUSTOM_TRAIL_WIDTH_M) : []
  const alreadyCleared = builtClearings(state)
  const treesToClear = inCorridor.filter(
    (tree) => !alreadyCleared.some((c) => distToPath(tree, { points: c.path }) < c.halfWu),
  ).length

  const groundworkCost = Math.round(analysis.lengthM * TRAIL_COST_PER_M)
  const clearingCost = treesToClear * TREE_CLEAR_COST

  const warnings: string[] = []
  if (analysis.topNodeId === null) {
    warnings.push('The start isn’t at a lift station or junction — skiers will never reach this run.')
  }
  if (analysis.bottomNodeId === null) {
    warnings.push('The run dead-ends mid-mountain — skiers will strand and patrol will have to sled them out.')
  } else if (analysis.topNodeId && analysis.bottomNodeId === analysis.topNodeId) {
    warnings.push('The run ends where it starts — nobody is going anywhere.')
  }
  if (analysis.totalClimbM > 2) {
    warnings.push(
      `The line climbs ${analysis.totalClimbM} m back uphill — skiers will get stuck hiking those stretches.`,
    )
  }

  return {
    analysis,
    treesToClear,
    groundworkCost,
    clearingCost,
    totalCost: groundworkCost + clearingCost,
    warnings,
  }
}

/** clearings from built custom trails and lift lines (repaint + dedup costing) */
export function builtClearings(state: GameState): { path: Vec2[]; halfWu: number }[] {
  const trails = Object.values(state.customTrailDefs).map((def) => ({
    path: def.path,
    halfWu: clearingHalfWidthWu(def.widthM),
  }))
  const lifts = Object.values(state.customLiftSites).map((site) => ({
    path: getLiftLine(state, site.id).points,
    halfWu: clearingHalfWidthWu(LIFT_CLEAR_WIDTH_M),
  }))
  return [...trails, ...lifts]
}

// ------------------------------------------------- point-to-point lifts

export interface LiftPlan {
  /** endpoints after node snapping, oriented bottom → top */
  bottom: Vec2
  top: Vec2
  bottomNodeId: string | null // existing node it snapped to
  topNodeId: string | null
  lengthM: number
  riseM: number
  treesToClear: number
  lineCost: number
  clearingCost: number
  totalCost: number
  warnings: string[]
}

/**
 * Price and sanity-check a lift between two clicked points. Endpoints snap
 * to existing network nodes; the lower end becomes the bottom regardless of
 * click order.
 */
export function planCustomLift(state: GameState, a: Vec2, b: Vec2, kind: LiftKind): LiftPlan {
  const nodes = allNodes(state)
  const resolve = (p: Vec2) => {
    const id = nearestNodeId(p, NODE_SNAP_WU, nodes)
    return { id, pos: id ? getNode(state, id)!.pos : p }
  }
  let lo = resolve(a)
  let hi = resolve(b)
  const elev = (r: { id: string | null; pos: Vec2 }) => (r.id ? getNode(state, r.id)!.elevation : elevationAt(r.pos))
  if (elev(lo) > elev(hi)) [lo, hi] = [hi, lo]

  const horiz = Math.hypot(lo.pos.x - hi.pos.x, lo.pos.y - hi.pos.y) * 2
  const riseM = Math.round(elev(hi) - elev(lo))
  const lengthM = Math.round(Math.hypot(horiz, riseM))

  const trees = treesInCorridor(state.seed, [lo.pos, hi.pos], LIFT_CLEAR_WIDTH_M)
  const alreadyCleared = builtClearings(state)
  const treesToClear = trees.filter(
    (tree) => !alreadyCleared.some((c) => distToPath(tree, { points: c.path }) < c.halfWu),
  ).length

  const lineCost = Math.round(LIFT_BASE_COST[kind] + lengthM * LIFT_COST_PER_M[kind])
  const clearingCost = treesToClear * TREE_CLEAR_COST

  const warnings: string[] = []
  const bottomNode = lo.id ? getNode(state, lo.id) : undefined
  if (!bottomNode?.isBase) {
    warnings.push(
      bottomNode
        ? `Loads at ${bottomNode.name} — only guests coming off a run there can ride it.`
        : 'The bottom terminal is out in the snow — guests can only reach it if a run ends there.',
    )
  }
  if (riseM < LIFT_MIN_RISE_M) {
    warnings.push(`Only ${riseM} m of rise — a lift needs at least ${LIFT_MIN_RISE_M} m.`)
  }
  if (!isOnMountain(lo.pos) || !isOnMountain(hi.pos)) {
    warnings.push('Terminal is past the ridgeline or outside the area — nothing but sky and backcountry there.')
  }

  return {
    bottom: lo.pos,
    top: hi.pos,
    bottomNodeId: lo.id,
    topNodeId: hi.id,
    lengthM,
    riseM,
    treesToClear,
    lineCost,
    clearingCost,
    totalCost: lineCost + clearingCost,
    warnings,
  }
}

/** base-area flats: terminals placed this low become walk-to-able nodes */
const BASE_ELEVATION_CUTOFF = 1268

/** create (or reuse) the network node for a custom lift terminal */
export function ensureNode(state: GameState, nodeId: string | null, pos: Vec2): string {
  if (nodeId) return nodeId
  const n = Object.keys(state.customNodes).length + 1
  const id = `cn-${n}`
  const elevation = Math.round(elevationAt(pos))
  state.customNodes[id] = {
    id,
    name: `Station ${n}`,
    pos: { x: Math.round(pos.x), y: Math.round(pos.y) },
    elevation,
    isBase: elevation <= BASE_ELEVATION_CUTOFF,
  }
  return id
}

// ---------------------------------------------------------------- creation

export function makeCustomTrailDef(state: GameState, points: Vec2[], plan: TrailPlan): TrailDef {
  const n = Object.keys(state.customTrailDefs).length
  const name = CUSTOM_TRAIL_NAMES[n] ?? `${CUSTOM_TRAIL_NAMES_FALLBACK} ${n + 1}`
  const a = plan.analysis

  // wind shelter from the forest remaining around the corridor
  const band = treesInCorridor(state.seed, points, CUSTOM_TRAIL_WIDTH_M * 3.5).length
  const per100m = a.lengthM > 0 ? band / (a.lengthM / 100) : 0
  const treeCoverage = Math.min(0.8, per100m * 0.14)

  return {
    id: `custom-${state.day}-${n + 1}`,
    name,
    difficulty: a.difficulty,
    topNodeId: a.topNodeId ?? '',
    bottomNodeId: a.bottomNodeId ?? '',
    path: points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
    lengthM: a.lengthM,
    verticalM: a.verticalM,
    widthM: CUSTOM_TRAIL_WIDTH_M,
    treeCoverage: Math.round(treeCoverage * 100) / 100,
    scenicAppeal: Math.min(0.9, 0.45 + treeCoverage * 0.3 + (elevationAt(points[0]) > 2000 ? 0.15 : 0)),
    riskFactor: 1.1 + a.uphillFraction * 1.5,
    buildCost: plan.totalCost,
    capacity: Math.max(15, Math.round(a.lengthM / 22)),
    isCustom: true,
    uphillSegments: a.uphillSegments,
    uphillFraction: a.uphillFraction,
    totalClimbM: a.totalClimbM,
  }
}
