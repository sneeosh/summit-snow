import { TRAIL_GRADE_WINDOW_M } from '../content/balance'

/** Exact sliding-window grade on a piecewise-linear elevation profile.
 * Positive drops accumulate separately so a climb cannot hide a steep descent.
 * Checking both ends of each segment makes the result independent of waypoint density.
 */
export function sustainedGradient(segments: { horizM: number; dropM: number }[], windowM = TRAIL_GRADE_WINDOW_M): number {
  const distance = [0], drop = [0]
  for (const s of segments) {
    if (s.horizM <= 0) continue
    distance.push(distance.at(-1)! + s.horizM)
    drop.push(drop.at(-1)! + Math.max(0, s.dropM))
  }
  const total = distance.at(-1)!
  if (total === 0) return 0
  const width = Math.min(total, Math.max(1, windowM))
  const at = (x: number): number => {
    if (x >= total) return drop.at(-1)!
    let lo = 0, hi = distance.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >>> 1
      if (distance[mid] <= x) lo = mid
      else hi = mid
    }
    return drop[lo] + (drop[hi] - drop[lo]) * (x - distance[lo]) / (distance[hi] - distance[lo])
  }
  let steepest = 0
  for (const boundary of distance) {
    for (const offset of [0, -width]) {
      const start = Math.max(0, Math.min(total - width, boundary + offset))
      steepest = Math.max(steepest, (at(start + width) - at(start)) / width)
    }
  }
  return steepest
}
