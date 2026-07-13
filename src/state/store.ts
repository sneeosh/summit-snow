/**
 * Zustand store: owns the GameState, the tick scheduler, UI state, and
 * wraps player actions so every mutation flows through one place. Sim
 * systems mutate the game object in place; we shallow-clone the top-level
 * reference afterwards so subscribers see a change.
 */
import { create } from 'zustand'
import { TICK_MINUTES, TICK_REAL_MS } from '../content/balance'
import * as actions from '../game/actions'
import { ensureMountain } from '../content/mountain'
import { buyResort, sellResort, switchResort } from '../game/company'
import { nearestOnTrail } from '../game/junctions'
import { allNodes, getNode, nearestNodeId } from '../game/trails'
import { resolveEvent } from '../game/events'
import { newGame } from '../game/init'
import { fastForwardDay, openResort, startNextDay, tick } from '../game/simulation'
import { AUTOSAVE_SLOT, loadGame, saveGame } from './save'
import type { FacilityKind, GameMode, GameState, LiftKind, Prices, StaffRole, Vec2 } from '../game/types'

export type Screen = 'menu' | 'playing'
export type Speed = 0 | 1 | 4

export type Selection =
  | { type: 'trail'; id: string }
  | { type: 'lift'; id: string }
  | { type: 'facility'; id: string }
  | { type: 'guest'; id: number }
  | null

export type BuildMode =
  | { type: 'draw-lift'; kind: LiftKind; first: Vec2 | null }
  | { type: 'trail' }
  | { type: 'draw-trail'; points: Vec2[] }
  | { type: 'snowmaking' }
  | { type: 'facility'; kind: FacilityKind }
  | null

export type Overlay = 'none' | 'difficulty' | 'snow' | 'crowding' | 'coverage'

export type LeftTab = 'build' | 'staff' | 'pricing' | 'finance' | 'overlays' | 'resorts' | null

interface Store {
  screen: Screen
  game: GameState | null
  speed: Speed
  selection: Selection
  buildMode: BuildMode
  overlay: Overlay
  leftTab: LeftTab
  bottomTab: 'alerts' | 'guests' | 'finance' | null
  actionError: string | null
  showReport: boolean
  /** bumps every sim tick — cheap subscription point for imperatively-read data */
  tickCount: number

  // lifecycle
  startNew: (mode: GameMode, seed?: number, mountainId?: string) => void
  loadSlot: (slot: string) => boolean
  saveSlot: (slot: string, label: string) => boolean
  toMenu: () => void

  // the resort company
  buyResort: (mountainId: string) => void
  sellResort: (mountainId: string) => void
  switchResortTo: (mountainId: string) => void

  // time
  setSpeed: (s: Speed) => void
  openResortNow: () => void
  endDayNow: () => void
  advanceToNextDay: () => void
  runTicks: (n: number) => void

  // trail drawing
  addDrawPoint: (p: Vec2) => void
  undoDrawPoint: () => void
  confirmDrawTrail: () => void
  /** double-click finish: drop the duplicate point the second click added, then cut */
  finishDrawTrail: () => void

  // lift placement
  addLiftPoint: (p: Vec2) => void

  // UI
  select: (sel: Selection) => void
  setBuildMode: (b: BuildMode) => void
  setOverlay: (o: Overlay) => void
  setLeftTab: (t: LeftTab) => void
  setBottomTab: (t: 'alerts' | 'guests' | 'finance' | null) => void
  clearError: () => void
  dismissReport: () => void
  completeTutorialStep: (id: string) => void
  skipTutorial: () => void

  // player actions
  buildLift: (siteId: string, kind: LiftKind) => void
  upgradeLift: (siteId: string, kind: LiftKind) => void
  setLiftOpen: (siteId: string, open: boolean) => void
  buildTrail: (trailId: string) => void
  setTrailOpen: (trailId: string, open: boolean) => void
  installSnowmaking: (trailId: string) => void
  buildFacility: (slotId: string, kind: FacilityKind) => void
  setStaffCount: (role: StaffRole, n: number) => void
  setPrices: (patch: Partial<Prices>) => void
  takeLoan: (offerId: string) => void
  resolveEventChoice: (eventId: string, choiceId: string) => void
}

/** phones start with panels closed — the mountain is the point */
function defaultLeftTab(): LeftTab {
  return typeof window !== 'undefined' && window.innerWidth < 768 ? null : 'build'
}

export const useStore = create<Store>((set, get) => {
  /** run a mutating game operation and publish the new reference */
  function mutate(fn: (g: GameState) => string | null | void): void {
    const game = get().game
    if (!game) return
    ensureMountain(game.mountainId)
    const err = fn(game) ?? null
    set({ game: { ...game }, actionError: err, tickCount: get().tickCount + 1 })
  }

  return {
    screen: 'menu',
    game: null,
    speed: 1,
    selection: null,
    buildMode: null,
    overlay: 'none',
    leftTab: defaultLeftTab(),
    bottomTab: null,
    actionError: null,
    showReport: false,
    tickCount: 0,

    startNew: (mode, seed, mountainId) => {
      const game = newGame(mode, seed ?? Math.floor(Math.random() * 2 ** 31), mountainId)
      set({
        screen: 'playing',
        game,
        speed: 1,
        selection: null,
        buildMode: null,
        overlay: 'none',
        leftTab: defaultLeftTab(),
        bottomTab: null,
        showReport: false,
        tickCount: 0,
      })
    },

    loadSlot: (slot) => {
      const state = loadGame(slot)
      if (!state) return false
      ensureMountain(state.mountainId)
      set({
        screen: 'playing',
        game: state,
        speed: state.phase === 'operating' ? 1 : 1,
        selection: null,
        buildMode: null,
        showReport: state.phase === 'day-end',
        tickCount: 0,
      })
      return true
    },

    saveSlot: (slot, label) => {
      const game = get().game
      if (!game) return false
      return saveGame(slot, game, label)
    },

    toMenu: () => set({ screen: 'menu', speed: 0 }),

    buyResort: (mountainId) => mutate((g) => buyResort(g, mountainId)),
    sellResort: (mountainId) => mutate((g) => sellResort(g, mountainId)),
    switchResortTo: (mountainId) => {
      const game = get().game
      if (!game) return
      ensureMountain(game.mountainId)
      const result = switchResort(game, mountainId)
      if (typeof result === 'string') {
        set({ actionError: result })
        return
      }
      set({
        game: result,
        selection: null,
        buildMode: null,
        overlay: 'none',
        showReport: result.phase === 'day-end',
        tickCount: get().tickCount + 1,
      })
    },

    setSpeed: (s) => set({ speed: s }),

    openResortNow: () =>
      mutate((g) => {
        openResort(g)
      }),

    endDayNow: () => {
      const game = get().game
      if (!game || game.phase !== 'operating') return
      fastForwardDay(game)
      afterSimAdvance(game)
      set({
        game: { ...game },
        tickCount: get().tickCount + 1,
        showReport: (game.phase as string) === 'day-end',
        speed: 0,
      })
    },

    advanceToNextDay: () =>
      mutate((g) => {
        startNextDay(g)
      }),

    runTicks: (n) => {
      const game = get().game
      if (!game || game.phase !== 'operating') return
      for (let i = 0; i < n && (game.phase as string) === 'operating'; i++) tick(game)
      if ((game.phase as string) === 'day-end') {
        afterSimAdvance(game)
        set({ showReport: true, speed: 0 })
      }
      set({ game: { ...game }, tickCount: get().tickCount + 1 })
    },

    addDrawPoint: (p) => {
      const bm = get().buildMode
      const game = get().game
      if (bm?.type !== 'draw-trail' || !game) return
      // snap to a lift station / junction when close — that's how skiers
      // enter and leave a run (custom lift terminals count!). Failing that,
      // snap onto a built trail: the endpoints become fork/merge junctions.
      const snapped = nearestNodeId(p, undefined, allNodes(game))
      const onTrail = snapped ? null : nearestOnTrail(game, p)
      const point = snapped ? { ...getNode(game, snapped)!.pos } : onTrail ? { ...onTrail.pos } : p
      set({ buildMode: { type: 'draw-trail', points: [...bm.points, point] } })
    },
    undoDrawPoint: () => {
      const bm = get().buildMode
      if (bm?.type !== 'draw-trail') return
      set({ buildMode: { type: 'draw-trail', points: bm.points.slice(0, -1) } })
    },
    confirmDrawTrail: () => {
      const bm = get().buildMode
      if (bm?.type !== 'draw-trail' || bm.points.length < 2) return
      const game = get().game
      if (!game) return
      const err = actions.buildCustomTrail(game, bm.points)
      set({
        game: { ...game },
        actionError: err,
        tickCount: get().tickCount + 1,
        ...(err ? {} : { buildMode: null }),
      })
    },
    finishDrawTrail: () => {
      const bm = get().buildMode
      if (bm?.type !== 'draw-trail' || bm.points.length < 3) return
      // the double-click's second click added a duplicate waypoint — drop it
      set({ buildMode: { type: 'draw-trail', points: bm.points.slice(0, -1) } })
      get().confirmDrawTrail()
    },

    addLiftPoint: (p) => {
      const bm = get().buildMode
      const game = get().game
      if (bm?.type !== 'draw-lift' || !game) return
      if (bm.first === null) {
        // snap the first terminal to a network node when close
        const snapped = nearestNodeId(p, undefined, allNodes(game))
        const point = snapped ? { ...getNode(game, snapped)!.pos } : p
        set({ buildMode: { ...bm, first: point } })
        return
      }
      const err = actions.buildCustomLift(game, bm.first, p, bm.kind)
      set({
        game: { ...game },
        actionError: err,
        tickCount: get().tickCount + 1,
        // keep the mode armed after an error so the player can adjust the top
        ...(err ? {} : { buildMode: null }),
      })
    },

    select: (selection) => set({ selection }),
    setBuildMode: (buildMode) =>
      set({
        buildMode,
        actionError: null,
        // phones: picking a build tool closes the panel — you need to see
        // the mountain you're about to build on
        ...(buildMode && typeof window !== 'undefined' && window.innerWidth < 768 ? { leftTab: null } : {}),
      }),
    setOverlay: (overlay) => set({ overlay }),
    setLeftTab: (leftTab) => set({ leftTab }),
    setBottomTab: (bottomTab) => set({ bottomTab }),
    clearError: () => set({ actionError: null }),
    dismissReport: () => set({ showReport: false }),

    completeTutorialStep: (id) =>
      mutate((g) => {
        if (!g.tutorialDone.includes(id)) g.tutorialDone.push(id)
      }),
    skipTutorial: () =>
      mutate((g) => {
        g.tutorialActive = false
      }),

    buildLift: (siteId, kind) => mutate((g) => actions.buildLift(g, siteId, kind)),
    upgradeLift: (siteId, kind) => mutate((g) => actions.upgradeLift(g, siteId, kind)),
    setLiftOpen: (siteId, open) => mutate((g) => actions.setLiftOpen(g, siteId, open)),
    buildTrail: (trailId) => mutate((g) => actions.buildTrail(g, trailId)),
    setTrailOpen: (trailId, open) => mutate((g) => actions.setTrailOpen(g, trailId, open)),
    installSnowmaking: (trailId) => mutate((g) => actions.installSnowmaking(g, trailId)),
    buildFacility: (slotId, kind) => mutate((g) => actions.buildFacility(g, slotId, kind)),
    setStaffCount: (role, n) => mutate((g) => actions.setStaffCount(g, role, n)),
    setPrices: (patch) => mutate((g) => actions.setPrices(g, patch)),
    takeLoan: (offerId) => mutate((g) => actions.takeLoan(g, offerId)),
    resolveEventChoice: (eventId, choiceId) =>
      mutate((g) => {
        resolveEvent(g, eventId, choiceId)
      }),
  }
})

/** autosave whenever a day closes */
function afterSimAdvance(game: GameState): void {
  saveGame(AUTOSAVE_SLOT, game, `Day ${game.day} — autosave`)
}

// ------------------------------------------------------------- scheduler

let loopStarted = false

/** fixed-interval scheduler: `speed` sim ticks per real interval */
export function startGameLoop(): void {
  if (loopStarted) return
  loopStarted = true
  setInterval(() => {
    const { screen, game, speed, runTicks } = useStore.getState()
    if (screen !== 'playing' || !game || game.phase !== 'operating' || speed === 0) return
    runTicks(speed)
  }, TICK_REAL_MS)
}

// -------------------------------------------------------------- selectors

export function formatClock(minute: number): string {
  const h = Math.floor(minute / 60)
  const m = Math.floor(minute % 60)
  return `${h}:${m.toString().padStart(2, '0')}`
}

export function formatMoney(v: number): string {
  const sign = v < 0 ? '−' : ''
  return `${sign}$${Math.abs(Math.round(v)).toLocaleString()}`
}

export const SIM_MINUTES_PER_SECOND = (1000 / TICK_REAL_MS) * TICK_MINUTES
