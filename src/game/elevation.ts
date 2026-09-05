import type { Landform, MountainDef, Vec2 } from './types'

/** Compact smooth influence: zero at the edge, no discontinuities in slope. */
export function landformWeight(form: Landform, p: Vec2): number {
  const r2 = ((p.x - form.center.x) / form.radius.x) ** 2 + ((p.y - form.center.y) / form.radius.y) ** 2
  return Math.max(0, 1 - r2) ** 3
}

/** Pure and independent of the active registry so authored nodes use this too. */
export function mountainElevation(m: MountainDef, p: Vec2): number {
  const baseline = m.topElev - (p.y - m.ySummit) * (m.topElev - m.baseElev) / (1040 - m.ySummit)
  return baseline + (m.identity?.landforms ?? []).reduce((z, form) => z + form.reliefM * landformWeight(form, p), 0)
}

export function mountainWindMultiplier(m: MountainDef, p: Vec2): number {
  return Math.max(0.5, Math.min(1.6, 1 + (m.identity?.landforms ?? [])
    .reduce((wind, form) => wind + (form.windMultiplier - 1) * landformWeight(form, p), 0)))
}
