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
import { ensureMountain, NODE_MAP } from '../content/mountain'
import { buyResort, switchResort } from '../game/company'

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
  delete old.mountainVersion // v7
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

  it('v6 saves pin active and inactive hills to their original layout', () => {
    const state = newGame('sandbox', 12, 'prairie')
    state.cash = 2_000_000
    buyResort(state, 'yuki')
    // v6 contained no geometry version or grooming plans.
    const strip = (s: GameState) => {
      const raw = s as unknown as Record<string, unknown>
      delete raw.mountainVersion
      for (const t of Object.values(s.trails)) delete (t as unknown as Record<string, unknown>).groomingPolicy
      s.version = 6
    }
    strip(state); strip(state.company.resortStates.yuki)
    backing.set('summit-snow:save:v6', JSON.stringify({ version: 6, state, label: 'old portfolio', savedAt: 'before' }))
    const loaded = loadGame('v6')!
    expect(loaded.mountainVersion).toBe(1)
    expect(loaded.company.resortStates.yuki.mountainVersion).toBe(1)
    expect(loaded.version).toBe(SAVE_VERSION)
    ensureMountain(loaded.mountainId, loaded.mountainVersion)
    expect(NODE_MAP.base.pos.x).toBe(950)
    const yuki = switchResort(loaded, 'yuki') as GameState
    expect(NODE_MAP.base.pos.x).toBe(950)
    expect(yuki.trails.bunny.groomingPolicy).toBe('auto')
    expect(saveGame('migrated', yuki, 'kept my hill')).toBe(true)
    expect(loadGame('migrated')).toEqual(yuki)
  })

  it('v7 portfolios retain revision two geometry', () => {
    const state = newGame('sandbox', 12, 'granite')
    state.mountainVersion = 2
    state.version = 7
    backing.set('summit-snow:save:v7', JSON.stringify({ version: 7, state }))
    const loaded = loadGame('v7')!
    expect(loaded.mountainVersion).toBe(2)
    expect(loaded.version).toBe(SAVE_VERSION)
    ensureMountain('granite', loaded.mountainVersion)
    expect(NODE_MAP.base.pos.x).toBe(950)
  })

  it('an unreadable save fails soft, not loud', () => {
    backing.set('summit-snow:save:junk', '{not json')
    expect(loadGame('junk')).toBeNull()
  })
})
