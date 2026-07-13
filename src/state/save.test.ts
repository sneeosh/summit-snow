/**
 * Save compatibility is a contract (CLAUDE.md): every schema bump ships a
 * migration, and a season-one save must load forever. This walks a v1-shaped
 * payload through the whole migration chain — the path a returning player's
 * localStorage actually takes.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { newGame, SAVE_VERSION } from '../game/init'
import type { GameState } from '../game/types'
import { loadGame, saveGame } from './save'

// vitest runs in node — give save.ts the localStorage it expects
const backing = new Map<string, string>()
beforeEach(() => {
  backing.clear()
  globalThis.localStorage = {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => void backing.set(k, v),
    removeItem: (k: string) => void backing.delete(k),
    clear: () => backing.clear(),
    key: (i: number) => [...backing.keys()][i] ?? null,
    get length() {
      return backing.size
    },
  } as Storage
})

/** strip a modern state down to what a v1 save actually contained */
function asV1Payload(state: GameState): string {
  const old: Record<string, unknown> = { ...state }
  delete old.customTrailDefs // v2
  delete old.customLiftSites // v3
  delete old.customNodes // v3
  delete old.junctions // v4
  delete old.mountainId // v5
  delete old.company // v5
  delete old.season // v6
  return JSON.stringify({ version: 1, savedAt: 'long ago', label: 'ancient save', state: old })
}

describe('save migrations', () => {
  it('a v1 save walks the whole chain to the current schema', () => {
    backing.set('summit-snow:save:old', asV1Payload(newGame('scenario', 12)))
    const loaded = loadGame('old')
    expect(loaded).not.toBeNull()
    const s = loaded!
    // every migration's additions are present and well-formed
    expect(s.customTrailDefs).toEqual({}) // v2
    expect(s.customLiftSites).toEqual({}) // v3
    expect(s.customNodes).toEqual({}) // v3
    expect(s.junctions).toEqual({}) // v4 (prebuilt greens don't cross)
    expect(s.mountainId).toBe('alder') // v5
    expect(s.company.holdings).toEqual([{ mountainId: 'alder', pricePaid: 0, dayAcquired: 1 }]) // v5
    expect(s.season).toBe(1) // v6
    // and the whole thing still survives the serialization contract
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })

  it('a current save round-trips unchanged', () => {
    const state = newGame('sandbox', 12, 'yuki')
    expect(saveGame('now', state, 'today')).toBe(true)
    const loaded = loadGame('now')
    expect(loaded).toEqual(state)
    expect(loaded!.version).toBe(SAVE_VERSION)
  })

  it('an unreadable save fails soft, not loud', () => {
    backing.set('summit-snow:save:junk', '{not json')
    expect(loadGame('junk')).toBeNull()
  })
})
