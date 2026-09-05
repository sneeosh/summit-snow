/** Regional operations queries. No mutable state or random draws. */
import { AVALANCHE_MOUNTAINS, AVALANCHE_STORM_CM, AVALANCHE_WIND_KPH, AVALANCHE_THAW_C, DAY_END_MIN, NIGHT_END_MIN } from '../content/balance'
import { ensureMountain } from '../content/mountain'
import { routeWindMultiplier } from './terrainModel'
import { getTrailDef } from './trails'
import type { GameState } from './types'

export function nightOperating(state: GameState): boolean {
  return state.mountainId === 'prairie' && Boolean(state.operations?.nightLighting && state.operations?.nightSkiing)
}
export function closingMinute(state: GameState): number { return nightOperating(state) ? NIGHT_END_MIN : DAY_END_MIN }

/** This is a game forecast, not a real-world avalanche assessment. */
export function avalancheRisk(state: GameState, trailId: string): 'low' | 'moderate' | 'high' {
  if (!AVALANCHE_MOUNTAINS.includes(state.mountainId)) return 'low'
  ensureMountain(state.mountainId, state.mountainVersion ?? 1)
  const def = getTrailDef(state, trailId)
  if (!def || !['black', 'double-black'].includes(def.difficulty)) return 'low'
  const weather = state.weatherSeason[state.day - 1]
  const recentSnow = state.weatherSeason.slice(Math.max(0, state.day - 3), state.day).reduce((sum, day) => sum + day.snowfallCm, 0)
  const loading = recentSnow >= AVALANCHE_STORM_CM
  const exposed = weather.windKph * routeWindMultiplier(def.path) >= AVALANCHE_WIND_KPH
  const thaw = weather.tempHigh >= AVALANCHE_THAW_C
  if (loading && (exposed || thaw || weather.snowfallCm >= AVALANCHE_STORM_CM)) return 'high'
  return loading || exposed || thaw ? 'moderate' : 'low'
}
export function avalancheHeld(state: GameState, trailId: string): boolean {
  return avalancheRisk(state, trailId) === 'high' && (state.operations?.avalancheClearedDay !== state.day || !state.operations.avalancheClearedTrails.includes(trailId))
}
export function avalancheRuns(state: GameState): string[] {
  return Object.values(state.trails).filter(t => t.built && avalancheRisk(state, t.trailId) === 'high').map(t => t.trailId)
}
