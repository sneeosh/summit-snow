/**
 * Trail junctions: where built trails cross or merge, skiers can pick a
 * line. This module owns the geometry — segment crossings with progress
 * along each path, endpoint-onto-trail merges, and the overlap detection
 * that rejects lines running down an existing corridor instead of crossing
 * it — plus the registry of junctions in GameState.
 *
 * Junctions are backed by real network nodes (customNodes), so everything
 * that already understands nodes (snapping, trail endpoints, rendering,
 * routing) understands junctions for free.
 */
import { measurePath, pointAt } from '../content/mountain'
import { distToPath, elevationAt } from './terrainModel'
import { allNodes, allTrailDefs, baseElevationCutoff, getTrailDef, getTrailPath } from './trails'
import type { GameState, TrailJunction, Vec2 } from './types'

/** clicked trail endpoints this close to a built trail merge into it (world units) */
export const TRAIL_MERGE_SNAP_WU = 20
/** two trails must cross at least this squarely, else it reads as overlap */
export const MIN_CROSS_ANGLE_DEG = 25
/** how much of a line may ride inside another trail's corridor before rejection */
const MAX_OVERLAP_WU = 44
/** crossings this close to an existing node don't spawn a new junction */
const NODE_CLEARANCE_WU = 30
/** crossings this close to an existing junction join it instead */
const JUNCTION_MERGE_WU = 18
/** legs past this progress are effectively the trail's end — not enterable */
export const LEG_END_T = 0.985

// ---------------------------------------------------------------- geometry

interface Crossing {
  pos: Vec2
  /** world-length progress along each path at the crossing */
  tNew: number
  tOther: number
  angleDeg: number
  otherTrailId: string
}

/** intersection of segments a0→a1 and b0→b1, with params along each */
function segCross(a0: Vec2, a1: Vec2, b0: Vec2, b1: Vec2): { p: Vec2; u: number; v: number } | null {
  const dax = a1.x - a0.x
  const day = a1.y - a0.y
  const dbx = b1.x - b0.x
  const dby = b1.y - b0.y
  const denom = dax * dby - day * dbx
  if (Math.abs(denom) < 1e-9) return null
  const u = ((b0.x - a0.x) * dby - (b0.y - a0.y) * dbx) / denom
  const v = ((b0.x - a0.x) * day - (b0.y - a0.y) * dax) / denom
  if (u < 0 || u > 1 || v < 0 || v > 1) return null
  return { p: { x: a0.x + dax * u, y: a0.y + day * u }, u, v }
}

function segAngleDeg(a0: Vec2, a1: Vec2, b0: Vec2, b1: Vec2): number {
  const angA = Math.atan2(a1.y - a0.y, a1.x - a0.x)
  const angB = Math.atan2(b1.y - b0.y, b1.x - b0.x)
  let d = Math.abs(angA - angB) % Math.PI
  if (d > Math.PI / 2) d = Math.PI - d
  return (d * 180) / Math.PI
}

/** all crossings of `points` against one built trail, with progress on both */
function crossingsAgainst(state: GameState, points: Vec2[], otherTrailId: string): Crossing[] {
  const mine = measurePath(points)
  const theirs = getTrailPath(state, otherTrailId)
  const out: Crossing[] = []
  for (let i = 1; i < mine.points.length; i++) {
    for (let j = 1; j < theirs.points.length; j++) {
      const hit = segCross(mine.points[i - 1], mine.points[i], theirs.points[j - 1], theirs.points[j])
      if (!hit) continue
      const segLenMine = mine.cum[i] - mine.cum[i - 1]
      const segLenTheirs = theirs.cum[j] - theirs.cum[j - 1]
      out.push({
        pos: hit.p,
        tNew: mine.total > 0 ? (mine.cum[i - 1] + segLenMine * hit.u) / mine.total : 0,
        tOther: theirs.total > 0 ? (theirs.cum[j - 1] + segLenTheirs * hit.v) / theirs.total : 0,
        angleDeg: segAngleDeg(mine.points[i - 1], mine.points[i], theirs.points[j - 1], theirs.points[j]),
        otherTrailId,
      })
    }
  }
  return out
}

function builtTrailIds(state: GameState, except?: string): string[] {
  return Object.values(state.trails)
    .filter((t) => t.built && t.trailId !== except)
    .map((t) => t.trailId)
}

/** closest point on one trail's path, with world-length progress */
function projectOnTrail(state: GameState, trailId: string, p: Vec2): { t: number; pos: Vec2; d: number } {
  const mp = getTrailPath(state, trailId)
  let best = { t: 0, pos: mp.points[0], d: Infinity }
  for (let i = 1; i < mp.points.length; i++) {
    const a = mp.points[i - 1]
    const b = mp.points[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lenSq = dx * dx + dy * dy
    let u = lenSq === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
    u = Math.max(0, Math.min(1, u))
    const q = { x: a.x + dx * u, y: a.y + dy * u }
    const d = Math.hypot(p.x - q.x, p.y - q.y)
    if (d < best.d) {
      const t = mp.total > 0 ? (mp.cum[i - 1] + (mp.cum[i] - mp.cum[i - 1]) * u) / mp.total : 0
      best = { t, pos: q, d }
    }
  }
  return best
}

/** nearest point on any built trail within maxD — for endpoint merges */
export function nearestOnTrail(
  state: GameState,
  p: Vec2,
  maxD = TRAIL_MERGE_SNAP_WU,
  except?: string,
): { trailId: string; t: number; pos: Vec2 } | null {
  let best: { trailId: string; t: number; pos: Vec2 } | null = null
  let bestD = maxD
  for (const trailId of builtTrailIds(state, except)) {
    const hit = projectOnTrail(state, trailId, p)
    if (hit.d < bestD) {
      bestD = hit.d
      best = { trailId, t: hit.t, pos: hit.pos }
    }
  }
  return best
}

// -------------------------------------------------------------- validation

export interface TrailConflicts {
  /** hard stops — the line can't be cut as drawn */
  blockers: string[]
  /** clean crossings that will become junctions */
  crossings: Crossing[]
  /** endpoints landing on an existing trail */
  topMerge: { trailId: string; t: number; pos: Vec2 } | null
  bottomMerge: { trailId: string; t: number; pos: Vec2 } | null
}

/**
 * How a drawn line interacts with the built network: merges at its ends,
 * junction-worthy crossings, and the two things we refuse — running down
 * an existing corridor, and crossing one at a grazing angle.
 */
export function checkTrailConflicts(state: GameState, points: Vec2[], except?: string): TrailConflicts {
  const conflicts: TrailConflicts = { blockers: [], crossings: [], topMerge: null, bottomMerge: null }
  if (points.length < 2) return conflicts

  const first = points[0]
  const last = points[points.length - 1]
  // endpoints on a trail merge into it (unless they already sit on a node)
  const nodes = allNodes(state)
  const nearNode = (p: Vec2) => nodes.some((n) => Math.hypot(n.pos.x - p.x, n.pos.y - p.y) < NODE_CLEARANCE_WU)
  if (!nearNode(first)) conflicts.topMerge = nearestOnTrail(state, first, TRAIL_MERGE_SNAP_WU, except)
  if (!nearNode(last)) conflicts.bottomMerge = nearestOnTrail(state, last, TRAIL_MERGE_SNAP_WU, except)

  const mine = measurePath(points)
  const endClearWu = TRAIL_MERGE_SNAP_WU * 2

  for (const otherId of builtTrailIds(state, except)) {
    const other = getTrailDef(state, otherId)
    const found = crossingsAgainst(state, points, otherId)
    for (const c of found) {
      // a crossing at either path's very end is the endpoint/node story, not a junction
      const nearOwnEnd = c.tNew * mine.total < endClearWu || (1 - c.tNew) * mine.total < endClearWu
      if (nearOwnEnd || c.tOther < 0.02 || c.tOther > 0.98) continue
      if (nearNode(c.pos)) continue
      if (c.angleDeg < MIN_CROSS_ANGLE_DEG) {
        conflicts.blockers.push(
          `Crosses ${other.name} at a grazing angle — square up the crossing or merge into it instead`,
        )
        continue
      }
      conflicts.crossings.push(c)
    }

    // overlap: how much of the new line rides inside this trail's corridor,
    // away from its declared crossings and merge points
    const corridorWu = (getTrailDef(state, otherId).widthM + 28) / 2 / 2 // both half-widths, metres → wu
    const exempt: Vec2[] = found.map((c) => c.pos)
    if (conflicts.topMerge?.trailId === otherId) exempt.push(conflicts.topMerge.pos)
    if (conflicts.bottomMerge?.trailId === otherId) exempt.push(conflicts.bottomMerge.pos)
    let overlapWu = 0
    const step = 6
    for (let d = 0; d <= mine.total; d += step) {
      const q = pointAt(mine, mine.total > 0 ? d / mine.total : 0)
      if (distToPath(q, getTrailPath(state, otherId)) > corridorWu) continue
      if (exempt.some((e) => Math.hypot(e.x - q.x, e.y - q.y) < 38)) continue
      overlapWu += step
    }
    if (overlapWu > MAX_OVERLAP_WU) {
      conflicts.blockers.push(
        `Runs down ${other.name} for ${Math.round(overlapWu * 2)} m — cross it, merge into it, or keep your own line`,
      )
    }
  }

  // dedupe blocker copy per trail
  conflicts.blockers = [...new Set(conflicts.blockers)]
  return conflicts
}

// ---------------------------------------------------------------- registry

function makeJunctionNode(state: GameState, pos: Vec2, name: string): string {
  const n = Object.keys(state.customNodes).length + 1
  const id = `cn-${n}`
  const elevation = Math.round(elevationAt(pos))
  state.customNodes[id] = {
    id,
    name,
    pos: { x: Math.round(pos.x), y: Math.round(pos.y) },
    elevation,
    isBase: elevation <= baseElevationCutoff(),
  }
  return id
}

/**
 * Create (or extend) the junction at `pos` and attach the given legs.
 * Returns the backing node id.
 */
export function ensureJunction(state: GameState, pos: Vec2, legs: { trailId: string; t: number }[], name: string): string {
  // fold into a close-by existing junction rather than stacking nodes
  for (const j of Object.values(state.junctions)) {
    const node = state.customNodes[j.nodeId]
    if (node && Math.hypot(node.pos.x - pos.x, node.pos.y - pos.y) < JUNCTION_MERGE_WU) {
      for (const leg of legs) {
        if (!j.legs.some((l) => l.trailId === leg.trailId && Math.abs(l.t - leg.t) < 0.02)) j.legs.push(leg)
      }
      return j.nodeId
    }
  }
  const nodeId = makeJunctionNode(state, pos, name)
  const junction: TrailJunction = { nodeId, legs: [...legs] }
  state.junctions[nodeId] = junction
  return nodeId
}

/**
 * Register junctions for every clean crossing between a just-built trail
 * and the rest of the built network. Returns how many crossings were made.
 */
export function registerTrailJunctions(state: GameState, trailId: string): number {
  const def = getTrailDef(state, trailId)
  if (!def) return 0
  const conflicts = checkTrailConflicts(state, def.path, trailId)
  for (const c of conflicts.crossings) {
    if (c.otherTrailId === trailId) continue
    const other = getTrailDef(state, c.otherTrailId)
    ensureJunction(
      state,
      c.pos,
      [
        { trailId, t: c.tNew },
        { trailId: c.otherTrailId, t: c.tOther },
      ],
      `${def.name} × ${other.name}`,
    )
  }
  return conflicts.crossings.length
}

/**
 * Recompute the junction registry from geometry — the save migration for
 * pre-junction saves, and idempotent on states that already have them.
 * Junction nodes nothing references are pruned; nodes trail endpoints still
 * point at (fork/merge junctions) get their legs re-derived by projection.
 */
export function rebuildJunctions(state: GameState): void {
  const oldNodeIds = new Set(Object.keys(state.junctions))
  state.junctions = {}

  const referenced = new Set<string>()
  for (const def of allTrailDefs(state)) {
    referenced.add(def.topNodeId)
    referenced.add(def.bottomNodeId)
  }
  for (const site of Object.values(state.customLiftSites)) {
    referenced.add(site.bottomNodeId)
    referenced.add(site.topNodeId)
  }
  for (const id of oldNodeIds) {
    if (!referenced.has(id)) delete state.customNodes[id]
  }
  // fork/merge junctions: the node sits on its host trail — re-derive legs
  for (const id of oldNodeIds) {
    const node = state.customNodes[id]
    if (!node) continue
    const legs: TrailJunction['legs'] = []
    for (const trailId of builtTrailIds(state)) {
      const def = getTrailDef(state, trailId)
      if (def.topNodeId === id || def.bottomNodeId === id) continue
      const hit = projectOnTrail(state, trailId, node.pos)
      if (hit.d < 4) legs.push({ trailId, t: hit.t })
    }
    if (legs.length > 0) state.junctions[id] = { nodeId: id, legs }
  }

  const ids = builtTrailIds(state)
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = getTrailDef(state, ids[i])
      const b = getTrailDef(state, ids[j])
      const nodes = allNodes(state)
      for (const c of crossingsAgainst(state, a.path, ids[j])) {
        if (c.tNew < 0.02 || c.tNew > 0.98 || c.tOther < 0.02 || c.tOther > 0.98) continue
        if (c.angleDeg < MIN_CROSS_ANGLE_DEG) continue
        if (nodes.some((n) => Math.hypot(n.pos.x - c.pos.x, n.pos.y - c.pos.y) < NODE_CLEARANCE_WU)) continue
        ensureJunction(
          state,
          c.pos,
          [
            { trailId: ids[i], t: c.tNew },
            { trailId: ids[j], t: c.tOther },
          ],
          `${a.name} × ${b.name}`,
        )
      }
    }
  }
}

// ----------------------------------------------------------------- queries

/** junction legs along a trail, ordered top to bottom — mid-run decision points */
export function junctionLegsOnTrail(state: GameState, trailId: string): { nodeId: string; t: number }[] {
  const out: { nodeId: string; t: number }[] = []
  for (const j of Object.values(state.junctions)) {
    for (const leg of j.legs) {
      if (leg.trailId === trailId) out.push({ nodeId: j.nodeId, t: leg.t })
    }
  }
  return out.sort((a, b) => a.t - b.t)
}

/** skiable ways out of a junction: other legs (entered mid-way) and trails starting here */
export function lineOptionsAt(
  state: GameState,
  nodeId: string,
  excludeTrailId: string | null,
): { trailId: string; entryT: number }[] {
  const junction = state.junctions[nodeId]
  const out: { trailId: string; entryT: number }[] = []
  if (junction) {
    for (const leg of junction.legs) {
      if (leg.trailId === excludeTrailId || leg.t >= LEG_END_T) continue
      const st = state.trails[leg.trailId]
      if (st?.built && st.open) out.push({ trailId: leg.trailId, entryT: leg.t })
    }
  }
  for (const def of allTrailDefs(state)) {
    if (def.topNodeId !== nodeId || def.id === excludeTrailId) continue
    const st = state.trails[def.id]
    if (st?.built && st.open && !out.some((o) => o.trailId === def.id)) out.push({ trailId: def.id, entryT: 0 })
  }
  return out
}
