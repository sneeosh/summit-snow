import { describe, expect, it } from 'vitest'
import { STARTING_CASH_SANDBOX } from '../content/balance'
import { ACTIVE_MOUNTAIN, ensureMountain } from '../content/mountain'
import { MOUNTAINS, MOUNTAIN_MAP } from '../content/mountains'
import { buildCustomLift, buildFacility } from './actions'
import { buyResort, saleValue, sellResort, switchResort } from './company'
import { newGame } from './init'
import { fastForwardDay, openResort, startNextDay } from './simulation'
import { elevationAt } from './terrainModel'
import type { GameState } from './types'

describe('mountain roster', () => {
  it('offers a few starters and keeps the trophies out of reach', () => {
    const affordable = MOUNTAINS.filter((m) => m.price <= STARTING_CASH_SANDBOX)
    const trophies = MOUNTAINS.filter((m) => m.price > STARTING_CASH_SANDBOX)
    expect(affordable.length).toBeGreaterThanOrEqual(2)
    expect(affordable.length).toBeLessThanOrEqual(4)
    expect(trophies.length).toBeGreaterThanOrEqual(3)
  })

  it('every mountain honours the authoring conventions', () => {
    for (const m of MOUNTAINS) {
      expect(m.nodes.some((n) => n.id === 'base' && n.isBase)).toBe(true)
      expect(m.prebuiltTrails.length).toBeGreaterThan(0)
      expect(m.liftSites.some((s) => s.prebuilt)).toBe(true)
      // ySummit matches the skyline's highest point
      expect(Math.min(...m.skyline.map(([, y]) => y))).toBe(m.ySummit)
      // skyline spans the world
      expect(m.skyline[0][0]).toBe(0)
      expect(m.skyline[m.skyline.length - 1][0]).toBe(1920)
      // prebuilt trails exist in the trail list
      for (const id of m.prebuiltTrails) expect(m.trails.some((t) => t.id === id)).toBe(true)
    }
  })

  it('elevation and geometry follow the active mountain', () => {
    const blanche = newGame('sandbox', 3, 'blanche')
    expect(blanche.mountainId).toBe('blanche')
    expect(ACTIVE_MOUNTAIN.id).toBe('blanche')
    expect(Math.round(elevationAt({ x: 950, y: 1040 }))).toBe(1100)
    expect(Math.round(elevationAt({ x: 960, y: 110 }))).toBe(3100)

    newGame('sandbox', 3, 'prairie')
    expect(ACTIVE_MOUNTAIN.id).toBe('prairie')
    expect(Math.round(elevationAt({ x: 950, y: 1040 }))).toBe(210)
  })

  it('sandbox pays the purchase price out of starting cash; scenario is staked', () => {
    const prairie = newGame('sandbox', 1, 'prairie')
    expect(prairie.cash).toBe(STARTING_CASH_SANDBOX - MOUNTAIN_MAP.prairie.price)
    const scenario = newGame('scenario', 1, 'blanche') // scenario ignores the pick
    expect(scenario.mountainId).toBe('alder')
  })
})

describe('the resort company', () => {
  function richAlder(): GameState {
    const state = newGame('sandbox', 42, 'alder')
    state.cash = 3_000_000
    return state
  }

  it('buys a resort, freezing an undeveloped copy in the portfolio', () => {
    const state = richAlder()
    expect(buyResort(state, 'yuki')).toBeNull()
    expect(state.cash).toBe(3_000_000 - MOUNTAIN_MAP.yuki.price)
    expect(state.company.holdings.map((h) => h.mountainId).sort()).toEqual(['alder', 'yuki'])
    const frozen = state.company.resortStates.yuki
    expect(frozen.mountainId).toBe('yuki')
    expect(frozen.cash).toBe(0)
    // buying elsewhere must not disturb the mountain under our feet
    expect(ACTIVE_MOUNTAIN.id).toBe('alder')

    expect(buyResort(state, 'yuki')).toMatch(/already/)
    expect(buyResort(state, 'blanche')).toMatch(/Not enough cash/)
  })

  it('switches resorts, carrying cash and freezing the old mountain as left', () => {
    const state = richAlder()
    buyResort(state, 'granite')
    buildFacility(state, 'v3', 'rental-shop') // develop alder a little

    const result = switchResort(state, 'granite')
    expect(typeof result).not.toBe('string')
    const next = result as GameState
    expect(next.mountainId).toBe('granite')
    expect(ACTIVE_MOUNTAIN.id).toBe('granite')
    expect(next.cash).toBe(state.cash)
    expect(next.company.resortStates.alder.facilities.v3).toBe('rental-shop')
    expect(next.company.resortStates.granite).toBeUndefined()

    // and back again, intact
    const home = switchResort(next, 'alder') as GameState
    expect(home.mountainId).toBe('alder')
    expect(home.facilities.v3).toBe('rental-shop')
    expect(home.company.resortStates.granite.mountainId).toBe('granite')
  })

  it('refuses to switch mid-day or to unowned mountains', () => {
    const state = richAlder()
    expect(switchResort(state, 'wasatch')).toMatch(/Buy it/)
    buyResort(state, 'granite')
    openResort(state)
    expect(switchResort(state, 'granite')).toMatch(/Close out the day/)
  })

  it('sells a non-active resort for base value plus a share of development', () => {
    const state = richAlder()
    buyResort(state, 'granite')

    // develop the frozen granite a bit by switching there and building
    let granite = switchResort(state, 'granite') as GameState
    ensureMountain('granite')
    expect(buildCustomLift(granite, { x: 950, y: 1040 }, { x: 900, y: 500 }, 'chair')).toBeNull()
    const backHome = switchResort(granite, 'alder') as GameState

    const value = saleValue(backHome, 'granite')
    expect(value).toBeGreaterThan(MOUNTAIN_MAP.granite.price * 0.7 - 1)
    const cashBefore = backHome.cash
    expect(sellResort(backHome, 'granite')).toBeNull()
    expect(backHome.cash).toBe(cashBefore + value)
    expect(backHome.company.holdings.map((h) => h.mountainId)).toEqual(['alder'])
    expect(backHome.company.resortStates.granite).toBeUndefined()

    expect(sellResort(backHome, 'alder')).toMatch(/standing on it/)
    expect(sellResort(backHome, 'granite')).toMatch(/Not in the portfolio/)
  })

  it('a full day simulates on a non-Alder mountain, deterministically', () => {
    const run = () => {
      const state = newGame('sandbox', 7, 'yuki')
      state.cash = 1_000_000
      openResort(state)
      fastForwardDay(state)
      return state
    }
    const a = run()
    const b = run()
    expect(a.reports[0].guestsServed).toBeGreaterThan(0)
    expect(JSON.parse(JSON.stringify(a))).toEqual(JSON.parse(JSON.stringify(b)))
    // Hokkaidō gets buried: season snowfall clearly outpaces a neutral climate
    const yukiSnow = a.weatherSeason.reduce((s, d) => s + d.snowfallCm, 0)
    const alderSnow = newGame('sandbox', 7, 'alder').weatherSeason.reduce((s, d) => s + d.snowfallCm, 0)
    expect(yukiSnow).toBeGreaterThan(alderSnow * 1.5)
  })

  it('company state survives a JSON round trip', () => {
    const state = richAlder()
    buyResort(state, 'prairie')
    const restored = JSON.parse(JSON.stringify(state)) as GameState
    expect(restored.company).toEqual(state.company)
  })

  it('caretakers wire half of a left-behind resort’s last daily profit', () => {
    const state = richAlder()
    // run a profitable day on alder so its books have a track record
    openResort(state)
    fastForwardDay(state)
    const alderProfit = state.reports[state.reports.length - 1].netProfit
    expect(alderProfit).toBeGreaterThan(0)

    buyResort(state, 'granite')
    const granite = switchResort(state, 'granite') as GameState
    const cashBefore = granite.cash
    openResort(granite)
    fastForwardDay(granite)
    const report = granite.reports[granite.reports.length - 1]
    expect(report.highlights.some((h) => h.includes('Caretakers'))).toBe(true)
    // the wire landed: cash moved by at least the caretaker cut on top of granite's own day
    expect(granite.cash).toBeGreaterThan(cashBefore + Math.round(alderProfit * 0.5) - 1)
  })
})

describe('rolling seasons', () => {
  it('sandbox rolls into a new season instead of ending', () => {
    const state = newGame('sandbox', 9, 'prairie')
    state.day = 60
    state.phase = 'day-end'
    const oldWeather = state.weatherSeason
    startNextDay(state)
    expect(state.gameOver).toBe(false)
    expect(state.season).toBe(2)
    expect(state.day).toBe(1)
    expect(state.phase).toBe('planning')
    expect(state.weatherSeason).not.toEqual(oldWeather)
    expect(state.weatherSeason.length).toBe(60)
  })
})
