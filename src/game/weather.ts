/**
 * Weather & snowpack.
 *
 * True weather for the whole season is generated up-front from the seed, so
 * the season replays identically. The forecast the player sees is the truth
 * plus noise that grows with lead time (stable per day/lead via hashNoise —
 * it never jitters between renders).
 */
import {
  SEASON_DAYS,
  ELEVATION_SNOW_BONUS,
  MELT_PER_DEGREE_ABOVE,
  WIND_STRIP_CM,
  SNOWMAKING_CM_PER_NIGHT,
  SNOWMAKING_MAX_TEMP,
  TRAIL_MIN_DEPTH_CM,
} from '../content/balance'
import { hashNoise, Rng } from './rng'
import { elevationAt } from './terrainModel'
import type { TrailDef, TrailState, WeatherDay } from './types'

/** resolves a trail id to its def (static content or player-drawn) */
export type TrailDefLookup = (id: string) => TrailDef

function isUpper(def: TrailDef): boolean {
  return elevationAt(def.path[0]) >= 2000
}

function isExposed(def: TrailDef): boolean {
  return def.treeCoverage < 0.3
}

export function generateSeasonWeather(seed: number): WeatherDay[] {
  const rng = new Rng(seed ^ 0x5eed)
  const days: WeatherDay[] = []
  // slow-moving pressure system the season meanders through
  let system = rng.range(-1, 1)
  for (let day = 1; day <= SEASON_DAYS; day++) {
    system += rng.range(-0.4, 0.4)
    system = Math.max(-1.6, Math.min(1.6, system))

    // mid-season is coldest; system < 0 = stormy/cold, > 0 = clear/mild
    const seasonCurve = Math.sin((day / SEASON_DAYS) * Math.PI) * 3
    const tempHigh = round1(-1 - seasonCurve + system * 4 + rng.range(-2, 2))
    const tempLow = round1(tempHigh - rng.range(5, 9))

    const stormy = system < -0.3
    const snowfallCm = stormy && rng.chance(0.75) ? Math.round(rng.range(4, 34) * (1 + -system * 0.4)) : rng.chance(0.12) ? rng.int(2, 6) : 0
    const windKph = Math.round(Math.max(4, (stormy ? rng.range(25, 62) : rng.range(4, 30)) + rng.range(-4, 4)))
    const cloud = clamp01(stormy ? rng.range(0.6, 1) : rng.range(0, 0.55))
    const visibility = clamp01(1 - cloud * 0.5 - (snowfallCm > 12 ? 0.3 : 0) - (windKph > 45 ? 0.15 : 0))

    days.push({
      day,
      tempHigh,
      tempLow,
      snowfallCm,
      windKph,
      visibility: round2(visibility),
      cloud: round2(cloud),
      summary: summarize(snowfallCm, cloud, windKph, tempHigh),
    })
  }
  return days
}

function summarize(snow: number, cloud: number, wind: number, tempHigh: number): string {
  if (snow >= 20) return 'Heavy snow'
  if (snow >= 8) return 'Snow showers'
  if (snow > 0) return 'Flurries'
  if (wind >= 45) return 'High winds'
  if (cloud < 0.25) return tempHigh > 2 ? 'Mild & sunny' : 'Bluebird'
  if (cloud < 0.6) return 'Partly cloudy'
  return 'Overcast'
}

/**
 * Forecast as seen from `today` — accuracy decays with lead. Lead 0 (today)
 * is exact.
 */
export function forecastFor(season: WeatherDay[], seed: number, today: number, day: number): WeatherDay {
  const truth = season[day - 1]
  const lead = Math.max(0, day - today)
  if (lead === 0 || !truth) return truth
  const wobble = Math.min(1, lead * 0.22)
  const n = (k: number) => (hashNoise(seed, day * 8 + k, lead) - 0.5) * 2 // [-1,1]
  return {
    ...truth,
    tempHigh: round1(truth.tempHigh + n(1) * 3 * wobble),
    tempLow: round1(truth.tempLow + n(2) * 3 * wobble),
    snowfallCm: Math.max(0, Math.round(truth.snowfallCm * (1 + n(3) * 0.8 * wobble) + n(4) * 4 * wobble)),
    windKph: Math.max(0, Math.round(truth.windKph + n(5) * 18 * wobble)),
    summary: lead >= 4 ? 'Uncertain' : truth.summary,
  }
}

export interface OvernightResult {
  groomedTrails: string[]
  snowmadeTrails: string[]
  meltedCm: number
}

/**
 * Applies overnight processes to every built trail: snowfall, melt, wind
 * stripping, snowmaking, grooming, and recomputes surface quality for the
 * coming day. Mutates trail states in place.
 */
export function processOvernight(
  trails: Record<string, TrailState>,
  tonight: WeatherDay, // weather of the day that is dawning
  opts: {
    groomerCapacity: number // trails that can be groomed
    snowmakingCapacity: number // trails guns can run on
    snowmakingBoost: number // pump station multiplier
    snowBonusCm: number // event-granted bonus
  },
  defOf: TrailDefLookup,
): OvernightResult {
  const result: OvernightResult = { groomedTrails: [], snowmadeTrails: [], meltedCm: 0 }

  const built = Object.values(trails).filter((t) => t.built)

  // grooming priority: open trails with most traffic wear first
  const groomQueue = built
    .filter((t) => t.open && t.snowDepthCm > 10)
    .sort((a, b) => b.traffic - a.traffic)
    .slice(0, opts.groomerCapacity)

  // snowmaking priority: thinnest trails with guns installed
  const canMakeSnow = tonight.tempLow <= SNOWMAKING_MAX_TEMP
  const snowQueue = canMakeSnow
    ? built
        .filter((t) => t.hasSnowmaking)
        .sort((a, b) => a.snowDepthCm - b.snowDepthCm)
        .slice(0, opts.snowmakingCapacity)
    : []

  for (const t of built) {
    const def = defOf(t.trailId)
    // natural snowfall (upper mountain catches more)
    const bonus = isUpper(def) ? 1 + ELEVATION_SNOW_BONUS : 1
    t.snowDepthCm += tonight.snowfallCm * bonus + opts.snowBonusCm

    // melt on warm afternoons
    if (tonight.tempHigh > 1) {
      const melt = (tonight.tempHigh - 1) * MELT_PER_DEGREE_ABOVE
      t.snowDepthCm -= melt
      result.meltedCm += melt
    }

    // wind strips exposed trails
    if (tonight.windKph > 45 && isExposed(def)) {
      t.snowDepthCm -= WIND_STRIP_CM
    }

    if (snowQueue.includes(t)) {
      t.snowDepthCm += SNOWMAKING_CM_PER_NIGHT * opts.snowmakingBoost
      result.snowmadeTrails.push(t.trailId)
    }

    t.snowDepthCm = Math.max(0, Math.round(t.snowDepthCm * 10) / 10)

    t.groomedOvernight = groomQueue.includes(t)
    if (t.groomedOvernight) {
      t.traffic = 0
      result.groomedTrails.push(t.trailId)
    } else {
      t.traffic *= 0.5 // some natural settling
    }

    t.surface = computeSurface(t, tonight, defOf)
    // trails without snow force-close
    if (t.snowDepthCm < TRAIL_MIN_DEPTH_CM) t.open = false
  }

  return result
}

export function computeSurface(t: TrailState, weather: WeatherDay, defOf: TrailDefLookup): TrailState['surface'] {
  const def = defOf(t.trailId)
  if (t.snowDepthCm < 30) return 'thin'
  if (weather.windKph > 45 && isExposed(def)) return 'wind-affected'
  if (weather.snowfallCm >= 10) return 'fresh-powder'
  // overnight grooming tills freeze-thaw crust back into corduroy
  if (t.groomedOvernight) return 'groomed'
  // freeze-thaw: warm day then hard freeze glazes ungroomed snow
  if (weather.tempLow < -6 && weather.tempHigh > 0) return 'icy'
  if (weather.snowfallCm >= 3) return 'packed-powder'
  if (weather.tempLow < -12) return 'firm'
  return 'packed-powder'
}

/** how much a surface helps (>1) or hurts (<1) the skiing experience */
export const SURFACE_ENJOYMENT: Record<TrailState['surface'], number> = {
  'fresh-powder': 1.35,
  groomed: 1.2,
  'packed-powder': 1.0,
  firm: 0.85,
  'wind-affected': 0.7,
  thin: 0.6,
  icy: 0.55,
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}
function round1(v: number): number {
  return Math.round(v * 10) / 10
}
function round2(v: number): number {
  return Math.round(v * 100) / 100
}
