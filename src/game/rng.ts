/**
 * Deterministic randomness. The whole simulation draws from one mulberry32
 * stream whose 32-bit state lives in GameState.rngState, so a saved game
 * replays identically. Systems construct an Rng around the stored state and
 * write `rng.state` back when the tick ends.
 */

export class Rng {
  state: number

  constructor(state: number) {
    this.state = state >>> 0
  }

  /** uniform float in [0, 1) */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  chance(p: number): boolean {
    return this.next() < p
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.min(arr.length - 1, Math.floor(this.next() * arr.length))]
  }

  /** rough bell curve around mid via 3-sample average */
  bell(min: number, max: number): number {
    const t = (this.next() + this.next() + this.next()) / 3
    return min + t * (max - min)
  }

  pickWeighted<T>(items: readonly { item: T; weight: number }[]): T {
    let total = 0
    for (const it of items) total += it.weight
    let roll = this.next() * total
    for (const it of items) {
      roll -= it.weight
      if (roll <= 0) return it.item
    }
    return items[items.length - 1].item
  }
}

/**
 * Stateless hash → [0,1). Used where we need stable pseudo-randomness that
 * must NOT consume the sim stream (e.g. forecast noise for day d viewed at
 * lead time l must be identical every render).
 */
export function hashNoise(seed: number, a: number, b = 0): number {
  let h = seed ^ Math.imul(a + 1, 0x85ebca6b) ^ Math.imul(b + 1, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
