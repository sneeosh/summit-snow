/**
 * Save compatibility is a contract (CLAUDE.md): every schema bump ships a
 * migration, and a season-one save must load forever. This walks a v1-shaped
 * payload through the whole migration chain — the path a returning player's
 * localStorage actually takes.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { newGame, SAVE_VERSION } from '../game/init'
import type { GameState } from '../game/types'
import { loadGame, saveGame, listSaves } from './save'
import { ensureMountain, NODE_MAP } from '../content/mountain'
import { proposeTownProject } from '../game/actions'
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
    state.cash = 100_000
    state.town.levels.housing = 2
    state.town.trust.residents = 63
    state.town.compactHomes = 1
    expect(proposeTownProject(state, 'shuttle')).toBeNull()
    state.town.construction!.remainingDays = 1
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

  it('v8 portfolios receive disabled operations without moving their terrain', () => {
    const state = newGame('sandbox', 71, 'prairie')
    state.cash = 2_000_000
    buyResort(state, 'kea')
    const strip = (s: GameState) => { delete (s as unknown as Record<string, unknown>).operations; s.version = 8 }
    strip(state); strip(state.company.resortStates.kea)
    backing.set('summit-snow:save:v8', JSON.stringify({ version: 8, state }))
    const loaded = loadGame('v8')!
    expect(loaded.operations).toEqual({ nightLighting: false, nightSkiing: false, avalancheClearedDay: 0, avalancheClearedTrails: [], controlCostToday: 0 })
    expect(loaded.company.resortStates.kea.operations).toEqual(loaded.operations)
    expect(loaded.mountainVersion).toBe(3)
    expect(loaded.version).toBe(SAVE_VERSION)
  })

  it('v9 portfolios gain independent empty towns and preserve operations', () => {
    const state = newGame('sandbox', 71, 'prairie')
    state.cash = 2_000_000
    state.operations.nightLighting = true
    buyResort(state, 'kea')
    const strip = (s: GameState) => { delete (s as unknown as Record<string, unknown>).town; s.version = 9 }
    strip(state); strip(state.company.resortStates.kea)
    backing.set('summit-snow:save:v9', JSON.stringify({ version: 9, state }))
    const loaded = loadGame('v9')!
    expect(loaded.town.levels).toEqual({ inn: 0, housing: 0, shuttle: 0, mainstreet: 0 })
    expect(loaded.company.resortStates.kea.town).toEqual(loaded.town)
    expect(loaded.company.resortStates.kea.town).not.toBe(loaded.town)
    expect(loaded.operations.nightLighting).toBe(true)
    expect(loaded.version).toBe(SAVE_VERSION)
  })

  it('v10 preserves construction and seeds honest scrapbook history', () => {
    const state = newGame('sandbox', 71, 'prairie')
    state.cash = 2_000_000
    buyResort(state, 'kea')
    state.town.levels.housing = 2
    state.town.construction = { project: 'inn', homes: true, remainingDays: 2, totalDays: 4 }
    const strip = (s: GameState) => {
      delete (s.town as unknown as Record<string, unknown>).policies
      delete (s.town as unknown as Record<string, unknown>).scrapbook
      s.version = 10
    }
    strip(state); strip(state.company.resortStates.kea)
    backing.set('summit-snow:save:v10', JSON.stringify({ version: 10, state }))
    const loaded = loadGame('v10')!
    expect(loaded.town.construction).toEqual(state.town.construction)
    expect(loaded.town.scrapbook[0].levels.housing).toBe(2)
    expect(loaded.town.scrapbook[0].label).toBe('The village when we arrived')
    expect(loaded.company.resortStates.kea.town.scrapbook[0].levels.housing).toBe(0)
    expect(saveGame('v11', loaded, 'with history')).toBe(true)
    expect(loadGame('v11')).toEqual(loaded)
  })

  it('an unreadable save fails soft, not loud', () => {
    backing.set('summit-snow:save:junk', '{not json')
    expect(loadGame('junk')).toBeNull()
  })
})

it('v11 migrates active and inactive holdings without inventing past rescue charges', () => {
  const s = newGame('sandbox', 91)
  s.company.resortStates.prairie = newGame('sandbox', 12, 'prairie')
  const old = JSON.parse(JSON.stringify(s))
  delete old.rescuesToday
  delete old.company.resortStates.prairie.rescuesToday
  old.version = old.company.resortStates.prairie.version = 11
  backing.set('summit-snow:save:v11', JSON.stringify({ version: 11, state: old }))
  const loaded = loadGame('v11')!
  expect(loaded.version).toBe(SAVE_VERSION)
  expect(loaded.rescuesToday).toEqual([])
  expect(loaded.company.resortStates.prairie.rescuesToday).toEqual([])
  expect(loaded.cash).toBe(s.cash)
  expect(loaded.town).toEqual(s.town)
})

it('in-flight rescues round-trip with the original dispatch charge and timeline', () => {
  const s = newGame('sandbox', 91)
  s.rescuesToday.push({ guestId: 7, trailId: Object.keys(s.trails)[0],
    location: { x: 50, y: 50 }, destination: { x: 500, y: 900 },
    injury: 'Compound fracture', transport: 'helicopter', startedMinute: 600,
    responseMinutes: 12, completed: false, cost: 4500 })
  s.cash -= 4500
  expect(saveGame('rescue', s, 'Rescue underway')).toBe(true)
  expect(loadGame('rescue')).toEqual(s)
})

 it('orders Continue candidates by saved time, including manual-only games', () => {
  const state = newGame('sandbox', 12, 'prairie')
  const put = (slot: string, day: number, savedAt: string) => backing.set(`summit-snow:save:${slot}`, JSON.stringify({version: SAVE_VERSION, savedAt, label: slot, state: {...state, day}}))
  put('manual', 5, '2026-09-05T21:09:20.000Z')
  expect(listSaves()[0].slot).toBe('manual')
  put('autosave', 4, '2026-09-05T21:08:43.000Z')
  expect(loadGame(listSaves()[0].slot)!.day).toBe(5)
  put('autosave', 6, '2026-09-05T21:20:00.000Z')
  expect(loadGame(listSaves()[0].slot)!.day).toBe(6)
 })

it('upgrades a production v12 save and preserves v14 customizations on reload',()=>{
  const state=newGame('sandbox',42,'prairie')
  const old={...state} as Partial<GameState>
  delete old.style;delete old.hostedEvents;delete old.postcards;delete old.recentVisits
  old.version=12
  backing.set('summit-snow:save:production',JSON.stringify({version:12,state:old}))
  const loaded=loadGame('production')!
  expect(loaded.version).toBe(SAVE_VERSION)
  expect(loaded.recentVisits).toEqual([])
  expect(loaded.style.trailNames).toEqual({})
  loaded.style.name='Snow & Co';loaded.style.decor='lanterns'
  saveGame('updated',loaded,'My resort')
  expect(loadGame('updated')!.style).toEqual(loaded.style)
})

it('restores paused and fast manual saves through the store',async()=>{
 const {useStore}=await import('./store')
 for(const speed of [0,4] as const){
 const game=newGame('sandbox',42,'prairie');game.phase='operating'
 useStore.setState({game,speed})
 expect(useStore.getState().saveSlot('polish','Polish test')).toBe(true)
 useStore.setState({game:null,speed:1})
 expect(useStore.getState().loadSlot('polish')).toBe(true)
 expect(useStore.getState().speed).toBe(speed)
 }
})

it('upgrades a 0.2 v15 portfolio without creativity fields',()=>{
 const state=newGame('sandbox',42,'prairie');state.cash=1e7;buyResort(state,'alder')
 const strip=(g:GameState)=>{const x=g as unknown as Record<string,unknown>;delete x.style;delete x.hostedEvents;delete x.postcards;g.version=15}
 strip(state);Object.values(state.company.resortStates).forEach(strip)
 localStorage.setItem('summit-snow:save:old-preview',JSON.stringify({version:15,savedAt:'2026-09-05',label:'0.2 preview',state}))
 const loaded=loadGame('old-preview')!
 expect(loaded.style.name).toBe('');expect(loaded.hostedEvents).toEqual([])
 const switched=switchResort(loaded,'alder') as GameState
 expect(switched.style.name).toBe('');expect(switched.postcards).toEqual([])
})
