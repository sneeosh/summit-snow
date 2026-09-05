import { describe, expect, it, vi } from 'vitest'
import { MEDEVAC_COST } from '../content/balance'
import { MOUNTAINS } from '../content/mountains'
import { settleDay } from './economy'
import { handleIncident, spawnArrivals, tickGuests } from './guests'
import { newGame } from './init'
import { Rng } from './rng'
import { rescueProgress } from './rescue'
import { closingMinute } from './operations'
import { fastForwardDay, startNextDay, tick } from './simulation'

function accident(helicopter = true, mountain = 'alder') {
  const state = newGame('sandbox', 91, mountain)
  state.phase = 'operating'
  state.arrivalCarry = 1
  state.targetDemandToday = 0
  const rng = new Rng(4)
  spawnArrivals(state, rng)
  const guest = Object.values(state.guests)[0]
  const trail = Object.values(state.trails).find(t => t.built)!
  guest.objective = 'skiing'
  guest.routeTrailId = trail.trailId
  guest.pos = { x: 700, y: 450 }
  trail.skierIds = [guest.id]
  vi.spyOn(rng, 'chance').mockReturnValueOnce(true).mockReturnValueOnce(helicopter)
  return { state, guest, trail, rng }
}

describe('serious incident rescue', () => {
  it.each(MOUNTAINS.map(m => m.id))('dispatches once on %s, keeps the casualty on the slope and removes them from the trail', mountain => {
    const { state, guest, trail, rng } = accident(true, mountain)
    state.cash = 10 // lack of funds must never strand the rescue
    handleIncident(state, guest, rng)
    expect(state.cash).toBe(10 - MEDEVAC_COST)
    expect(guest.objective).toBe('rescue')
    expect(guest.pos).toEqual({ x: 700, y: 450 })
    expect(trail.skierIds).not.toContain(guest.id)
    expect(state.rescuesToday[0].injury).toBe('Compound fracture')
    handleIncident(state, guest, rng)
    expect(state.cash).toBe(10 - MEDEVAC_COST)
    expect(state.incidentsToday).toBe(1)
    expect(state.rescuesToday).toHaveLength(1)
  })

  it('reports helicopter cost once alongside control work without charging again at settlement', () => {
    const { state, guest, rng } = accident()
    const baseline = structuredClone(state)
    state.operations.controlCostToday = baseline.operations.controlCostToday = 650
    handleIncident(state, guest, rng)
    const { report } = settleDay(state, new Rng(1))
    const { report: other } = settleDay(baseline, new Rng(1))
    expect(baseline.cash - state.cash).toBe(MEDEVAC_COST)
    expect(report.expenses.medevac).toBe(MEDEVAC_COST)
    expect(report.expenses.other).toBe(MEDEVAC_COST + 650)
    expect(other.netProfit - report.netProfit).toBe(MEDEVAC_COST)
  })

  it('keeps sled rescues free of helicopter charges and delivers the skier to base', () => {
    const { state, guest, rng } = accident(false)
    const cash = state.cash
    handleIncident(state, guest, rng)
    state.minute += 40
    tickGuests(state, new Rng(2))
    expect(state.rescuesToday[0].completed).toBe(true)
    expect(guest.pos).toEqual(state.rescuesToday[0].destination)
    expect(['first-aid', 'leaving']).toContain(guest.objective)
    expect(state.cash).toBe(cash)
  })

  it('completes late rescues before day end and matches live ticks to day skipping after serialization', () => {
    const { state, guest, rng } = accident()
    state.minute = closingMinute(state) + 74
    handleIncident(state, guest, rng)
    const live = JSON.parse(JSON.stringify(state))
    tick(state)
    expect(state.phase).toBe('operating')
    fastForwardDay(state)
    let guard = 500
    while (live.phase === 'operating' && guard-- > 0) tick(live)
    expect(guard).toBeGreaterThan(0)
    expect(state).toEqual(live)
    expect(state.rescuesToday[0].completed).toBe(true)
    expect(state.guests[guest.id]).toBeUndefined()
    expect(state.departedToday).toHaveLength(1)
    expect(state.reports[0].expenses.medevac).toBe(MEDEVAC_COST)
    startNextDay(state)
    expect(state.rescuesToday).toEqual([])
    expect(state.reports[0].expenses.medevac).toBe(MEDEVAC_COST)
  })

  it('choreography stays fixed when paused and never consumes RNG or mutates a save', () => {
    const { state, guest, rng } = accident()
    handleIncident(state, guest, rng)
    const before = JSON.stringify(state)
    const incident = state.rescuesToday[0]
    expect(rescueProgress(incident, state.minute).stage).toBe('Patrol responding')
    expect(rescueProgress(incident, state.minute + incident.responseMinutes).stage).toBe('Stabilizing injury')
    expect(rescueProgress(incident, state.minute + 18).stage).toBe('Air evacuation')
    expect(rescueProgress(incident, state.minute + 40).position).toEqual(incident.destination)
    expect(JSON.stringify(state)).toBe(before)
  })
})
