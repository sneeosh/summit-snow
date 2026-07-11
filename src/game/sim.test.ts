import { describe, expect, it } from 'vitest'
import { buildFacility, buildLift, buildTrail, setStaffCount, takeLoan } from './actions'
import { computeDailyDemand, settleDay } from './economy'
import { LocalEventProvider, applyEffects, validateEffect } from './events'
import { chooseTrail, difficultyFit, planLifts } from './guests'
import { newGame } from './init'
import { Rng, hashNoise } from './rng'
import { fastForwardDay, openResort, startNextDay, tick } from './simulation'
import { forecastFor, generateSeasonWeather, processOvernight } from './weather'
import type { GameState } from './types'

// ---------------------------------------------------------------- helpers

/** a developed resort ready to operate: chair to mid, blue trail, staffed */
function developedResort(seed = 42): GameState {
  const g = newGame('scenario', seed)
  takeLoan(g, 'expansion')
  expect(buildLift(g, 'alder-chair', 'chair')).toBeNull()
  expect(buildTrail(g, 'alder-run')).toBeNull()
  expect(buildFacility(g, 'v3', 'cafe')).toBeNull()
  expect(buildFacility(g, 'v4', 'restroom')).toBeNull()
  expect(buildFacility(g, 'v5', 'rental-shop')).toBeNull()
  setStaffCount(g, 'lift-ops', 4)
  setStaffCount(g, 'patrol', 2)
  setStaffCount(g, 'rental', 2)
  setStaffCount(g, 'food-service', 2)
  setStaffCount(g, 'grooming', 2)
  return g
}

// -------------------------------------------------------------------- rng

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rng(123)
    const b = new Rng(123)
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next())
  })

  it('hashNoise is stable and in [0,1)', () => {
    for (let i = 0; i < 200; i++) {
      const v = hashNoise(99, i, 7)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
      expect(hashNoise(99, i, 7)).toBe(v)
    }
  })
})

// ---------------------------------------------------------------- weather

describe('weather', () => {
  it('generates a full deterministic season', () => {
    const a = generateSeasonWeather(7)
    const b = generateSeasonWeather(7)
    expect(a).toEqual(b)
    expect(a.length).toBe(60)
    expect(a.some((d) => d.snowfallCm > 0)).toBe(true)
  })

  it('forecast is exact for today and stable across calls', () => {
    const season = generateSeasonWeather(7)
    const today = forecastFor(season, 7, 5, 5)
    expect(today).toEqual(season[4])
    const f1 = forecastFor(season, 7, 5, 9)
    const f2 = forecastFor(season, 7, 5, 9)
    expect(f1).toEqual(f2)
  })

  it('overnight snowfall accumulates and grooming resets traffic', () => {
    const g = newGame('scenario', 1)
    const trail = g.trails['bunny-hollow']
    trail.traffic = 40
    const before = trail.snowDepthCm
    processOvernight(g.trails, { ...g.weatherSeason[0], snowfallCm: 20, tempHigh: -5, windKph: 10 }, {
      groomerCapacity: 5,
      snowmakingCapacity: 0,
      snowmakingBoost: 1,
      snowBonusCm: 0,
    })
    expect(trail.snowDepthCm).toBeGreaterThan(before)
    expect(trail.traffic).toBe(0)
    expect(trail.groomedOvernight).toBe(true)
  })

  it('warm days melt the snowpack', () => {
    const g = newGame('scenario', 1)
    const trail = g.trails['bunny-hollow']
    const before = trail.snowDepthCm
    processOvernight(g.trails, { ...g.weatherSeason[0], snowfallCm: 0, tempHigh: 8, tempLow: 1, windKph: 5 }, {
      groomerCapacity: 0,
      snowmakingCapacity: 0,
      snowmakingBoost: 1,
      snowBonusCm: 0,
    })
    expect(trail.snowDepthCm).toBeLessThan(before)
  })
})

// ---------------------------------------------------------------- economy

describe('economy', () => {
  it('demand is zero with no open trails', () => {
    const g = newGame('scenario', 3)
    for (const t of Object.values(g.trails)) t.open = false
    expect(computeDailyDemand(g)).toBe(0)
  })

  it('cheaper tickets draw bigger crowds', () => {
    const g = developedResort()
    g.prices.adultTicket = 40
    const cheap = computeDailyDemand(g)
    g.prices.adultTicket = 90
    const pricey = computeDailyDemand(g)
    expect(cheap).toBeGreaterThan(pricey)
  })

  it('settleDay pays wages and reports a balanced ledger', () => {
    const g = developedResort()
    const cashBefore = g.cash
    const rng = new Rng(1)
    const { report } = settleDay(g, rng)
    expect(g.cash).toBeLessThan(cashBefore) // payroll etc. with no revenue
    const expTotal =
      report.expenses.payroll +
      report.expenses.maintenance +
      report.expenses.energy +
      report.expenses.facilities +
      report.expenses.interest
    expect(report.netProfit).toBe(Math.round(0 - expTotal))
    expect(report.expenses.payroll).toBeGreaterThan(0)
  })
})

// ----------------------------------------------------------------- guests

describe('guest decisions', () => {
  it('difficulty fit matches skill to terrain', () => {
    expect(difficultyFit('first-timer', 'green', 0.1)).toBeGreaterThan(0.9)
    expect(difficultyFit('first-timer', 'black', 0.1)).toBe(0)
    expect(difficultyFit('expert', 'double-black', 0.8)).toBeGreaterThan(difficultyFit('expert', 'green', 0.8))
  })

  it('plans lift routes through the graph', () => {
    const g = developedResort()
    expect(planLifts(g, 'base', 'mid')).toEqual(['alder-chair'])
    expect(planLifts(g, 'base', 'summit')).toBeNull() // no summit lift yet
    // beginner base connects on foot to the village lifts
    expect(planLifts(g, 'beginner-base', 'mid')).toEqual(['alder-chair'])
  })

  it('guests choose reachable trails that fit their level', () => {
    const g = developedResort()
    openResort(g)
    const rng = new Rng(5)
    // hand-roll a guest via spawn machinery: run a few ticks until someone exists
    for (let i = 0; i < 400 && Object.keys(g.guests).length === 0; i++) tick(g)
    const guest = Object.values(g.guests)[0]
    expect(guest).toBeDefined()
    guest.skill = 'intermediate'
    guest.atNodeId = 'base'
    const choice = chooseTrail(g, guest)
    expect(choice).not.toBeNull()
    expect(['alder-run', 'pinecone-way', 'bunny-hollow']).toContain(choice!.trailId)
    void rng
  })
})

// ----------------------------------------------------------------- events

describe('events', () => {
  it('local provider is deterministic per seed/day', () => {
    const provider = new LocalEventProvider()
    const ctx = {
      day: 6,
      seed: 11,
      reputation: 3,
      cash: 50000,
      incidentsYesterday: 0,
      weatherSummary: 'Bluebird',
      snowfallCm: 0,
      openTrailCount: 3,
      hasRestaurant: false,
      staffMorale: 0.7,
    }
    expect(provider.generate(ctx)).toEqual(provider.generate(ctx))
  })

  it('rejects malformed effects and applies valid ones', () => {
    expect(validateEffect({ kind: 'cash', amount: 100 })).toBe(true)
    expect(validateEffect({ kind: 'hack' as never, amount: 1 })).toBe(false)
    expect(validateEffect({ kind: 'cash', amount: NaN })).toBe(false)
    const g = newGame('scenario', 2)
    const before = g.cash
    applyEffects(g, [
      { kind: 'cash', amount: 500 },
      { kind: 'hack' as never, amount: 999999 },
    ])
    expect(g.cash).toBe(before + 500)
  })
})

// ------------------------------------------------------------- full loop

describe('full operating day (integration)', () => {
  it('runs a developed resort through a day: guests arrive, spend, and settle', () => {
    const g = developedResort(1234)
    openResort(g)
    expect(g.phase).toBe('operating')
    expect(g.targetDemandToday).toBeGreaterThan(30)

    fastForwardDay(g)

    expect(g.phase).toBe('day-end')
    expect(g.guestsArrivedToday).toBeGreaterThan(20)
    expect(g.reports.length).toBe(1)
    const report = g.reports[0]
    expect(report.revenue.tickets).toBeGreaterThan(0)
    expect(report.guestsServed).toBe(g.guestsArrivedToday)
    expect(Object.keys(g.guests).length).toBe(0) // everyone went home
    expect(report.avgSatisfaction).toBeGreaterThan(20)

    // next morning resets and re-opens
    startNextDay(g)
    expect(g.phase).toBe('planning')
    expect(g.day).toBe(2)
    openResort(g)
    expect(g.phase).toBe('operating')
  })

  it('is deterministic: same seed, same season story', () => {
    const run = (): { cash: number; guests: number; rep: number } => {
      const g = developedResort(777)
      for (let day = 0; day < 3; day++) {
        openResort(g)
        fastForwardDay(g)
        if (day < 2) startNextDay(g)
      }
      return { cash: Math.round(g.cash), guests: g.totalGuestsSeason, rep: g.reputation }
    }
    expect(run()).toEqual(run())
  })

  it('lift rides actually happen', () => {
    const g = developedResort(99)
    openResort(g)
    fastForwardDay(g)
    const rides = Object.values(g.lifts).reduce((s, l) => s + l.totalRidesToday, 0)
    expect(rides).toBeGreaterThan(20)
  })
})

// ------------------------------------------------------------- save/load

describe('save round-trip', () => {
  it('game state survives JSON serialization exactly', () => {
    const g = developedResort(55)
    openResort(g)
    for (let i = 0; i < 500; i++) tick(g)
    const restored = JSON.parse(JSON.stringify(g)) as GameState
    expect(restored).toEqual(g)
    // and the restored copy simulates identically
    const a = JSON.parse(JSON.stringify(g)) as GameState
    const b = JSON.parse(JSON.stringify(g)) as GameState
    for (let i = 0; i < 200; i++) {
      tick(a)
      tick(b)
    }
    expect(a).toEqual(b)
  })
})
