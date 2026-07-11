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
  TRAIL_COST_PER_M,
  TREE_CLEAR_COST,
} from '../content/balance'
import { measurePath, NODES, TRAIL_MAP, TRAIL_PATHS, type MeasuredPath } from '../content/mountain'
import { CUSTOM_TRAIL_NAMES } from '../content/names'
import { clearingHalfWidthWu, distToPath, elevationAt, treesInCorridor } from './terrainModel'
import type { Difficulty, GameState, TrailDef, Vec2 } from './types'

/** snap radius for attaching trail endpoints to network nodes (world units) */
export const NODE_SNAP_WU = 45

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

export function nearestNodeId(p: Vec2, radius = NODE_SNAP_WU): string | null {
  let best: string | null = null
  let bestD = radius
  for (const node of NODES) {
    const d = Math.hypot(node.pos.x - p.x, node.pos.y - p.y)
    if (d < bestD) {
      bestD = d
      best = node.id
    }
  }
  return best
}

export function analyzePath(points: Vec2[]): PathAnalysis {
  const empty: PathAnalysis = {
    lengthM: 0,
    verticalM: 0,
    steepest: 0,
    difficulty: 'green',
    uphillSegments: [],
    uphillFraction: 0,
    totalClimbM: 0,
    topNodeId: points.length > 0 ? nearestNodeId(points[0]) : null,
    bottomNodeId: points.length > 1 ? nearestNodeId(points[points.length - 1]) : null,
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
    topNodeId: nearestNodeId(points[0]),
    bottomNodeId: nearestNodeId(points[points.length - 1]),
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
  const analysis = analyzePath(points)

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

/** clearings from already-built custom trails (for repaint + dedup costing) */
export function builtClearings(state: GameState): { path: Vec2[]; halfWu: number }[] {
  return Object.values(state.customTrailDefs).map((def) => ({
    path: def.path,
    halfWu: clearingHalfWidthWu(def.widthM),
  }))
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
