/**
 * Versioned save persistence in localStorage. Payloads carry a schema
 * version; migrations upgrade old saves step by step so future schema
 * changes never strand a player.
 */
import { SAVE_VERSION } from '../game/init'
import type { GameState } from '../game/types'

const PREFIX = 'summit-snow:save:'
export const AUTOSAVE_SLOT = 'autosave'

interface SavePayload {
  version: number
  savedAt: string
  label: string
  state: GameState
}

/** version → upgrade fn producing the next version's payload */
const MIGRATIONS: Record<number, (payload: SavePayload) => SavePayload> = {
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
