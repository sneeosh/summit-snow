/**
 * The day-end handoff — the exact seam where two soft-locks shipped: the
 * report offering a dead end at day 60 in sandbox, and the scenario needing
 * a true ending. dayEndDisposition is what the report renders from.
 */
import { describe, expect, it } from 'vitest'
import { SEASON_DAYS } from '../content/balance'
import { newGame } from './init'
import { dayEndDisposition, fastForwardDay, openResort, startNextDay } from './simulation'

describe('day-end disposition', () => {
  it('an ordinary day offers tomorrow', () => {
    const s = newGame('sandbox', 4, 'prairie')
    s.phase = 'day-end'
    expect(dayEndDisposition(s)).toBe('next-day')
  })

  it('sandbox day 60 offers the next season, and taking it works', () => {
    const s = newGame('sandbox', 4, 'prairie')
    s.day = SEASON_DAYS
    openResort(s)
    fastForwardDay(s)
    expect(s.gameOver).toBe(false)
    expect(dayEndDisposition(s)).toBe('season-rolls')
    startNextDay(s) // what the report button dispatches
    expect(s.season).toBe(2)
    expect(s.day).toBe(1)
    expect(s.phase).toBe('planning')
  })

  it('scenario day 60 is a real ending', () => {
    const s = newGame('scenario', 4)
    s.day = SEASON_DAYS
    openResort(s)
    fastForwardDay(s)
    expect(s.gameOver).toBe(true)
    expect(dayEndDisposition(s)).toBe('game-over')
  })

  it('scenario bankruptcy is a real ending too', () => {
    const s = newGame('scenario', 4)
    s.cash = -60_000
    openResort(s)
    fastForwardDay(s)
    expect(s.gameOver).toBe(true)
    expect(dayEndDisposition(s)).toBe('game-over')
  })
})
