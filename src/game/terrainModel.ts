/**
 * The mountain as data: the skyline silhouette, a continuous elevation
 * model, and the deterministic forest. Shared by the simulation (trail
 * analysis, tree-clearing costs) and the renderer (painting), so what you
 * see is exactly what you pay to cut down.
 */
import { hashNoise } from './rng'
import { LIFT_LINES, TRAIL_PATHS, TRAILS, WORLD_H, WORLD_W, type MeasuredPath } from '../content/mountain'
import type { Vec2 } from './types'

/** the mountain skyline polygon (x rises to summit, ridge, descends right) */
export const SKYLINE: [number, number][] = [
  [0, 560],
  [130, 520],
  [300, 460],
  [470, 400],
  [620, 330],
  [780, 230],
  [940, 170],
  [1040, 205],
  [1160, 250],
  [1270, 290],
  [1370, 330],
  [1520, 420],
  [1680, 520],
  [1920, 640],
]

export function skylineYAt(x: number): number {
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
 * Continuous elevation (m) — the summit sits at y=170 (2,350 m) and the
 * base village at y=1040 (1,250 m); elevation is linear in y between and
 * beyond. Downhill therefore means increasing y.
 */
export function elevationAt(p: Vec2): number {
  const M_PER_Y = (2350 - 1250) / (1040 - 170)
  return 2350 - (p.y - 170) * M_PER_Y
}

// ------------------------------------------------------------------ forest

export interface Tree {
  x: number
  y: number
  size: number
  tone: number
}

const treeCache = new Map<number, Tree[]>()

/**
 * Every tree on the mountain, deterministic per seed. Trees already avoid
 * the surveyed trail corridors and lift lines (pre-cleared by the mountain
 * planner); custom trails must clear — and pay for — what they cross.
 */
export function scatterTrees(seed: number): Tree[] {
  const cached = treeCache.get(seed)
  if (cached) return cached

  const corridorHalfWidth = (widthM: number) => widthM / 2 + 14
  const trees: Tree[] = []

  for (let i = 0; i < 1500; i++) {
    const x = hashNoise(seed, i, 11) * WORLD_W
    const y = hashNoise(seed, i, 12) * WORLD_H

    const skyY = skylineYAt(x)
    if (y < skyY + 30) continue // above treeline near ridge
    if (y < skyY + 120 && hashNoise(seed, i, 13) < 0.7) continue // sparse near treeline
    if (y > 1040) continue // village floor
    // density noise: clumpy forests, open bowls
    const clump = hashNoise(seed, Math.floor(x / 140), Math.floor(y / 140) + 900)
    if (hashNoise(seed, i, 14) > clump * 1.25) continue

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

  treeCache.set(seed, trees)
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
