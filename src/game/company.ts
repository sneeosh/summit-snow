/**
 * The resort company: buying, selling, and moving between mountains. Each
 * owned resort keeps its own frozen GameState inside the active state's
 * company block; cash is company-wide and rides with whichever mountain
 * you're standing on. You manage one resort at a time — the others hold
 * their breath until you come back.
 */
import { FACILITIES, LIFT_TYPES, SNOWMAKING_INSTALL_COST } from '../content/balance'
import { ensureMountain, LIFT_SITE_MAP, TRAIL_MAP } from '../content/mountain'
import { MOUNTAIN_MAP, RESALE_BASE_RATIO, RESALE_DEVELOPMENT_RATIO } from '../content/mountains'
import { pushAlert } from './guests'
import { newGame } from './init'
import type { GameState } from './types'

function owns(state: GameState, mountainId: string): boolean {
  return state.company.holdings.some((h) => h.mountainId === mountainId)
}

/** deterministic per-mountain seed so a purchase is reproducible */
function purchaseSeed(state: GameState, mountainId: string): number {
  let h = state.seed >>> 0
  for (let i = 0; i < mountainId.length; i++) h = (h * 31 + mountainId.charCodeAt(i)) >>> 0
  return h
}

/**
 * Money the player has sunk into a resort's infrastructure — what a buyer
 * will partially honour on sale. Uses the frozen state's own mountain
 * context, so activate it before reading content maps.
 */
export function developmentValue(resort: GameState): number {
  ensureMountain(resort.mountainId)
  let value = 0
  for (const lift of Object.values(resort.lifts)) {
    const site = LIFT_SITE_MAP[lift.siteId] ?? resort.customLiftSites[lift.siteId]
    if (site?.prebuilt) continue
    value += site?.isCustom ? (site.buildCost ?? LIFT_TYPES[lift.kind].buildCost) : LIFT_TYPES[lift.kind].buildCost
  }
  for (const trail of Object.values(resort.trails)) {
    if (!trail.built) continue
    const def = TRAIL_MAP[trail.trailId] ?? resort.customTrailDefs[trail.trailId]
    if (def) value += def.buildCost
    if (trail.hasSnowmaking) value += SNOWMAKING_INSTALL_COST
  }
  const mountain = MOUNTAIN_MAP[resort.mountainId]
  const prebuiltSlots = new Set(mountain?.facilitySlots.filter((s) => s.prebuilt).map((s) => s.id))
  for (const [slotId, kind] of Object.entries(resort.facilities)) {
    if (kind && !prebuiltSlots.has(slotId)) value += FACILITIES[kind].buildCost
  }
  return Math.round(value)
}

/** what selling a resort fetches right now */
export function saleValue(state: GameState, mountainId: string): number {
  const def = MOUNTAIN_MAP[mountainId]
  if (!def) return 0
  const resort = mountainId === state.mountainId ? state : state.company.resortStates[mountainId]
  const dev = resort ? developmentValue(resort) : 0
  ensureMountain(state.mountainId)
  return Math.round(def.price * RESALE_BASE_RATIO + dev * RESALE_DEVELOPMENT_RATIO)
}

export function buyResort(state: GameState, mountainId: string): string | null {
  const def = MOUNTAIN_MAP[mountainId]
  if (!def) return 'Unknown mountain'
  if (owns(state, mountainId)) return `${def.name} is already in the portfolio`
  if (state.cash < def.price) {
    return `Not enough cash — ${def.name} costs $${def.price.toLocaleString()}`
  }
  state.cash -= def.price

  // the new resort arrives undeveloped; company cash stays with you
  const fresh = newGame('sandbox', purchaseSeed(state, mountainId), mountainId)
  fresh.cash = 0
  fresh.company = { holdings: [], resortStates: {} }
  fresh.tutorialActive = false // you know the business by your second mountain
  state.company.resortStates[mountainId] = fresh
  state.company.holdings.push({ mountainId, pricePaid: def.price, dayAcquired: state.day })

  ensureMountain(state.mountainId) // newGame activated the purchase; come home
  pushAlert(state, 'info', `${def.name} acquired for $${def.price.toLocaleString()} — the keys are yours`)
  return null
}

export function sellResort(state: GameState, mountainId: string): string | null {
  const def = MOUNTAIN_MAP[mountainId]
  if (!def || !owns(state, mountainId)) return 'Not in the portfolio'
  if (mountainId === state.mountainId) return 'You’re standing on it — switch resorts before selling'

  const value = saleValue(state, mountainId)
  state.cash += value
  state.company.holdings = state.company.holdings.filter((h) => h.mountainId !== mountainId)
  delete state.company.resortStates[mountainId]
  pushAlert(state, 'info', `${def.name} sold for $${value.toLocaleString()}`)
  return null
}

/**
 * Move the company to another owned resort. Returns the new active
 * GameState, or an error string. The old resort freezes exactly as left;
 * cash and the portfolio ride along.
 */
export function switchResort(state: GameState, mountainId: string): GameState | string {
  if (!owns(state, mountainId)) return 'Buy it before you can run it'
  if (mountainId === state.mountainId) return state
  if (state.phase === 'operating') return 'Close out the day before leaving the mountain'
  const target = state.company.resortStates[mountainId]
  if (!target) return 'That resort’s books are missing' // should never happen

  const resortStates = { ...state.company.resortStates }
  delete resortStates[mountainId]
  resortStates[state.mountainId] = { ...state, company: { holdings: [], resortStates: {} } }

  const next: GameState = {
    ...target,
    cash: state.cash,
    company: { holdings: state.company.holdings, resortStates },
  }
  ensureMountain(next.mountainId)
  return next
}
