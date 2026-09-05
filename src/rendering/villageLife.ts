/** Small procedural village scenes; animation never consumes simulation RNG. */
import { Graphics } from 'pixi.js'
import { DAY_END_MIN } from '../content/balance'
import { FACILITY_SLOTS, pointAt } from '../content/mountain'
import { avalancheHeld, nightOperating } from '../game/operations'
import { hashNoise } from '../game/rng'
import { staffCount } from '../game/resort'
import { getTrailPath } from '../game/trails'
import type { GameState } from '../game/types'

export function darkness(state: GameState): number {
  return nightOperating(state) ? Math.max(0, Math.min(1, (state.minute - DAY_END_MIN) / 60)) : 0
}

export function paintVillageLife(g: Graphics, state: GameState, time: number): void {
  g.clear()
  const dark = darkness(state)
  const crowd = state.phase === 'operating' ? Math.min(5, Math.ceil(Object.keys(state.guests).length / 40)) : 0
  for (const [index, slot] of FACILITY_SLOTS.entries()) {
    const kind = state.facilities[slot.id]
    if (!kind) continue
    const { x, y } = slot.pos
    if (kind === 'parking') {
      for (let i = 0; i < Math.min(4, crowd); i++) {
        const cx = x - 15 + i * 10
        g.roundRect(cx, y - 4, 8, 13, 2).fill([0xa55549, 0x3b667e, 0xd9caae, 0x6a7763][i])
        g.rect(cx + 1, y - 1, 6, 3).fill(0xb8d4df)
      }
      continue
    }
    if (dark > 0) {
      g.ellipse(x, y + 16, 24, 9).fill({ color: 0xffd087, alpha: dark * 0.2 })
      const width = kind === 'base-lodge' || kind === 'restaurant' ? 46 : 32
      for (const side of [-1, 1]) g.rect(x + side * width * 0.29 - 3, y - 3, 6, 5).fill({ color: 0xffd987, alpha: dark * 0.9 })
    }
    const warm = ['base-lodge', 'cafe', 'restaurant'].includes(kind)
    if (warm) {
      // Chimney and slow wind-blown puffs.
      g.rect(x + 11, y - 25, 5, 12).fill(0x75695d)
      const wind = state.weatherSeason[state.day - 1].windKph / 60
      for (let puff = 0; puff < 4; puff++) {
        const age = (time * 0.2 + puff / 4 + index * 0.17) % 1
        g.circle(x + 13 + age * (9 + wind * 18), y - 26 - age * 31, 2 + age * 5)
          .fill({ color: dark ? 0xbccbdc : 0xffffff, alpha: (1 - age) * 0.35 })
      }
      // Benches and little mugs sit beside the entrance, clear of the door.
      g.roundRect(x + 26, y + 5, 19, 4, 1).fill(0x826548)
      g.rect(x + 28, y + 9, 2, 5).fill(0x574a3a)
      g.rect(x + 41, y + 9, 2, 5).fill(0x574a3a)
    }
    const served = (warm && staffCount(state, 'food-service') > 0)
      || (kind === 'rental-shop' && staffCount(state, 'rental') > 0)
      || (kind === 'ski-school' && staffCount(state, 'instructors') > 0)
    if (!served) continue
    for (let person = 0; person < crowd; person++) {
      const phase = hashNoise(state.seed, index, person + 21)
      const px = x - 20 + person * 9, py = y + 22 + Math.sin(time * 0.8 + phase * 8) * 1.5
      g.ellipse(px + 2, py + 5, 4, 1.5).fill({ color: 0x435c70, alpha: 0.25 })
      g.roundRect(px - 2, py - 1, 4, 6, 1).fill([0xb55242, 0x3d737e, 0xd5a655][person % 3])
      g.circle(px, py - 3, 2).fill(0xe5bc9b)
      g.moveTo(px - 1, py + 5).lineTo(px - 2, py + 8).moveTo(px + 1, py + 5).lineTo(px + 2, py + 8).stroke({ width: 1, color: 0x34495b })
      if (warm) g.rect(px + 3, py, 2, 2).fill(0xf5eee1)
    }
  }
  for (const trail of Object.values(state.trails)) {
    if (!trail.built) continue
    const path = getTrailPath(state, trail.trailId)
    if (avalancheHeld(state, trail.trailId)) {
      const p = pointAt(path, 0.03)
      g.moveTo(p.x - 17, p.y - 3).lineTo(p.x + 17, p.y + 3).stroke({ width: 4, color: 0xe59442 })
      for (let i = -12; i <= 12; i += 8) g.moveTo(p.x + i, p.y - 3).lineTo(p.x + i + 4, p.y + 3).stroke({ width: 2, color: 0x403c36 })
    }
    if (!state.operations.nightLighting || state.mountainId !== 'prairie') continue
    const count = Math.max(2, Math.ceil(path.total / 110))
    for (let i = 0; i <= count; i++) {
      const p = pointAt(path, i / count), px = p.x + 18
      if (dark > 0) {
        g.ellipse(p.x, p.y, 30, 16).fill({ color: 0xe9f3ff, alpha: dark * 0.2 })
        g.ellipse(p.x, p.y, 17, 9).fill({ color: 0xffe9b6, alpha: dark * 0.15 })
      }
      g.moveTo(px, p.y + 3).lineTo(px, p.y - 16).lineTo(px - 7, p.y - 16).stroke({ width: 1.5, color: 0x66727b })
      g.rect(px - 10, p.y - 18, 7, 3).fill(dark ? 0xffe6a5 : 0xd8d8ca)
    }
  }
}
