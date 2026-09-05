/**
 * Versioned save persistence in localStorage. Payloads carry a schema
 * version; migrations upgrade old saves step by step so future schema
 * changes never strand a player.
 */
import { newTown, townMemory } from '../game/town'
import { SAVE_VERSION } from '../game/init'
import { rebuildJunctions } from '../game/junctions'
import type { GameState } from '../game/types'

const PREFIX = 'summit-snow:save:'
export const AUTOSAVE_SLOT = 'autosave'

interface SavePayload {
  version: number
  savedAt: string
  label: string
  state: GameState
}

/** Preserve geometry for every resort, including inactive portfolio holdings. */
function migrateMountainIdentity(state: GameState): GameState {
  return {
    ...state, version: SAVE_VERSION, mountainVersion: 1,
    trails: Object.fromEntries(Object.entries(state.trails).map(([id, t]) => [id, { ...t, groomingPolicy: 'auto' }])),
    company: { ...state.company, resortStates: Object.fromEntries(
      Object.entries(state.company.resortStates).map(([id, resort]) => [id, migrateMountainIdentity(resort)]),
    ) },
  }
}

/** version → upgrade fn producing the next version's payload */
const MIGRATIONS: Record<number, (payload: SavePayload) => SavePayload> = {
  12: (p) => {
    const upgrade = (s: GameState): GameState => ({ ...s, version: 13, recentVisits: [],
      company: { ...s.company, resortStates: Object.fromEntries(Object.entries(s.company.resortStates).map(([id, r]) => [id, upgrade(r)])) },
    })
    return { ...p, version: 13, state: upgrade(p.state) }
  },
  11: (p) => {
    const upgrade = (s: GameState): GameState => ({ ...s, version: 12, rescuesToday: [],
      company: { ...s.company, resortStates: Object.fromEntries(Object.entries(s.company.resortStates).map(([id, r]) => [id, upgrade(r)])) },
    })
    return { ...p, version: 12, state: upgrade(p.state) }
  },
  10: (p) => {
    const upgrade = (s: GameState): GameState => {
      const town = { ...s.town, policies: { winterMarket: false, darkSky: false }, scrapbook: [] as GameState['town']['scrapbook'] }
      town.scrapbook.push(townMemory(town, s.day, s.season, 'The village when we arrived'))
      return { ...s, version: 11, town, company: { ...s.company, resortStates: Object.fromEntries(Object.entries(s.company.resortStates).map(([id, r]) => [id, upgrade(r)])) } }
    }
    return { ...p, version: 11, state: upgrade(p.state) }
  },
  9: (p) => {
    const upgrade = (s: GameState): GameState => ({ ...s, version: 10, town: newTown(),
      company: { ...s.company, resortStates: Object.fromEntries(Object.entries(s.company.resortStates).map(([id, r]) => [id, upgrade(r)])) },
    })
    return { ...p, version: 10, state: upgrade(p.state) }
  },
  8: (p) => {
    const upgrade = (s: GameState): GameState => ({ ...s, version: 9,
      operations: { nightLighting: false, nightSkiing: false, avalancheClearedDay: 0, avalancheClearedTrails: [], controlCostToday: 0 },
      company: { ...s.company, resortStates: Object.fromEntries(Object.entries(s.company.resortStates).map(([id, r]) => [id, upgrade(r)])) },
    })
    return { ...p, version: 9, state: upgrade(p.state) }
  },
  // v8 keeps already-open resorts on their saved content revision.
  7: (p) => {
    const upgrade = (s: GameState): GameState => ({ ...s, version: SAVE_VERSION,
      mountainVersion: s.mountainVersion ?? 2,
      company: { ...s.company, resortStates: Object.fromEntries(Object.entries(s.company.resortStates).map(([id, r]) => [id, upgrade(r)])) },
    })
    return { ...p, version: 8, state: upgrade(p.state) }
  },
  6: (p) => ({ ...p, version: 7, state: migrateMountainIdentity(p.state) }),
  // v2: freeform trails — custom defs container + per-guest stuck tracking
  1: (p) => ({
    ...p,
    version: 2,
    state: {
      ...p.state,
      customTrailDefs: {},
      guests: Object.fromEntries(
        Object.entries(p.state.guests).map(([id, g]) => [id, { ...g, stuckSegIdx: -1 }]),
      ),
    },
  }),
  // v3: point-to-point lifts — custom alignments + dynamic network nodes
  2: (p) => ({
    ...p,
    version: 3,
    state: { ...p.state, customLiftSites: {}, customNodes: {} },
  }),
  // v4: trail junctions — recompute crossings from the built network
  3: (p) => {
    const state = { ...p.state, junctions: {} }
    rebuildJunctions(state)
    return { ...p, version: 4, state }
  },
  // v5: the resort company — old saves become a one-mountain portfolio
  4: (p) => ({
    ...p,
    version: 5,
    state: {
      ...p.state,
      mountainId: 'alder',
      company: {
        holdings: [{ mountainId: 'alder', pricePaid: 0, dayAcquired: 1 }],
        resortStates: {},
      },
    },
  }),
  // v6: rolling sandbox seasons
  5: (p) => ({
    ...p,
    version: 6,
    state: {
      ...p.state,
      season: 1,
      company: {
        ...p.state.company,
        resortStates: Object.fromEntries(
          Object.entries(p.state.company.resortStates).map(([id, s]) => [id, { ...s, season: 1 }]),
        ),
      },
    },
  }),
}

export function saveGame(slot: string, state: GameState, label: string): boolean {
  try {
    const payload: SavePayload = {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      label,
      state,
    }
    localStorage.setItem(PREFIX + slot, JSON.stringify(payload))
    return true
  } catch (err) {
    console.error('Save failed', err)
    return false
  }
}

export function loadGame(slot: string): GameState | null {
  try {
    const raw = localStorage.getItem(PREFIX + slot)
    if (!raw) return null
    let payload = JSON.parse(raw) as SavePayload
    while (payload.version < SAVE_VERSION) {
      const migrate = MIGRATIONS[payload.version]
      if (!migrate) {
        console.error(`No migration from save version ${payload.version}`)
        return null
      }
      payload = migrate(payload)
    }
    return payload.state
  } catch (err) {
    console.error('Load failed', err)
    return null
  }
}

export interface SaveSlotInfo {
  slot: string
  label: string
  savedAt: string
  day: number
  cash: number
  mode: string
}

export function listSaves(): SaveSlotInfo[] {
  const out: SaveSlotInfo[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(PREFIX)) continue
    try {
      const payload = JSON.parse(localStorage.getItem(key)!) as SavePayload
      out.push({
        slot: key.slice(PREFIX.length),
        label: payload.label,
        savedAt: payload.savedAt,
        day: payload.state.day,
        cash: Math.round(payload.state.cash),
        mode: payload.state.mode,
      })
    } catch {
      // unreadable save — skip it
    }
  }
  return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export function deleteSave(slot: string): void {
  localStorage.removeItem(PREFIX + slot)
}
