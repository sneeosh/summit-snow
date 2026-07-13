/**
 * The mountain as data: the skyline silhouette, a continuous elevation
 * model, and the deterministic forest. Shared by the simulation (trail
 * analysis, tree-clearing costs) and the renderer (painting), so what you
 * see is exactly what you pay to cut down.
 */
import { hashNoise } from './rng'
import { ACTIVE_MOUNTAIN, LIFT_LINES, TRAIL_PATHS, TRAILS, WORLD_H, WORLD_W, type MeasuredPath } from '../content/mountain'
import type { Vec2 } from './types'

/** the active mountain's skyline polygon (x rises to summit, descends right) */
export function skyline(): [number, number][] {
  return ACTIVE_MOUNTAIN.skyline
}

export function skylineYAt(x: number): number {
  const SKYLINE = ACTIVE_MOUNTAIN.skyline
  for (let i = 1; i < SKYLINE.length; i++) {
    if (SKYLINE[i][0] >= x) {
      const [x0, y0] = SKYLINE[i - 1]
      const [x1, y1] = SKYLINE[i]
      const f = (x - x0) / (x1 - x0)
      return y0 + (y1 - y0) * f
    }
  }
  return SKYLINE[SKYLINE.length - 1][1]
}

/**
 * Continuous elevation (m) — linear in y between the active mountain's two
 * anchors: topElev at y=ySummit and baseElev at the village floor (y=1040).
 * Downhill therefore means increasing y, and a mountain with more vertical
 * grades the same drawn line steeper.
 */
export function elevationAt(p: Vec2): number {
  const m = ACTIVE_MOUNTAIN
  const M_PER_Y = (m.topElev - m.baseElev) / (1040 - m.ySummit)
  return m.topElev - (p.y - m.ySummit) * M_PER_Y
}

// ------------------------------------------------------------------ forest

export interface Tree {
  x: number
  y: number
  size: number
  tone: number
}

const treeCache = new Map<string, Tree[]>()

/**
 * Every tree on the mountain, deterministic per seed (and per mountain —
 * an untouched hill is FOREST below its treeline; what varies by region is
 * how thick, and how high the trees climb). Trees already avoid the
 * surveyed trail corridors and lift lines; custom trails must clear — and
 * pay for — what they cross. Returned sorted by y so painting reads with
 * correct depth.
 */
export function scatterTrees(seed: number): Tree[] {
  const cacheKey = `${ACTIVE_MOUNTAIN.id}:${seed}`
  const cached = treeCache.get(cacheKey)
  if (cached) return cached

  const corridorHalfWidth = (widthM: number) => widthM / 2 + 14
  const density = ACTIVE_MOUNTAIN.treeDensity
  const treeline = ACTIVE_MOUNTAIN.treelineElev
  const trees: Tree[] = []

  for (let i = 0; i < 5200; i++) {
    const x = hashNoise(seed, i, 11) * WORLD_W
    const y = hashNoise(seed, i, 12) * WORLD_H

    const skyY = skylineYAt(x)
    if (y < skyY + 24) continue // bare rock right at the ridgeline
    if (y > 1040) continue // village floor

    // regional treeline: nothing above it, thinning krummholz just below
    const elev = elevationAt({ x, y })
    if (elev > treeline) continue
    const taper = Math.min(1, (treeline - elev) / 70) // sparse in the top 70 m
    if (hashNoise(seed, i, 13) > taper) continue

    // density noise: clumpy forests, open glades
    const clump = 0.45 + hashNoise(seed, Math.floor(x / 140), Math.floor(y / 140) + 900) * 0.75
    if (hashNoise(seed, i, 14) > clump * density) continue

    // surveyed corridors are already clear
    let blocked = false
    for (const t of TRAILS) {
      if (distToPath({ x, y }, TRAIL_PATHS[t.id]) < corridorHalfWidth(t.widthM)) {
        blocked = true
        break
      }
    }
    if (blocked) continue
    if (nearLiftLine(x, y)) continue

    trees.push({ x, y, size: 7 + hashNoise(seed, i, 15) * 9, tone: hashNoise(seed, i, 16) })
  }

  trees.sort((a, b) => a.y - b.y) // paint top-down so canopies overlap correctly
  treeCache.set(cacheKey, trees)
  return trees
}

function nearLiftLine(x: number, y: number): boolean {
  for (const key of Object.keys(LIFT_LINES)) {
    if (distToPath({ x, y }, LIFT_LINES[key]) < 16) return true
  }
  return false
}

// ------------------------------------------------------------- path maths

export function distToPath(p: Vec2, mp: MeasuredPath | { points: Vec2[] }): number {
  let best = Infinity
  const pts = mp.points
  for (let i = 1; i < pts.length; i++) {
    best = Math.min(best, distToSegment(p.x, p.y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y))
  }
  return best
}

export function distToSegment(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0
  const dy = y1 - y0
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((px - x0) * dx + (py - y0) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t))
}

/**
 * Clearing half-width for a custom corridor, in world units. Used by BOTH
 * the cost calculation and the terrain repaint, so the player pays for
 * exactly the trees that disappear.
 */
export function clearingHalfWidthWu(widthM: number): number {
  return widthM / 2 + 6
}

/** trees inside a corridor of the given path */
export function treesInCorridor(seed: number, path: Vec2[], widthM: number): Tree[] {
  const halfWu = clearingHalfWidthWu(widthM)
  const shape = { points: path }
  return scatterTrees(seed).filter((tree) => distToPath(tree, shape) < halfWu)
}
