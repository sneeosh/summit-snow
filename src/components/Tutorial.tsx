/** Contextual, non-blocking tutorial: one nudge at a time, auto-advancing. */
import { useEffect } from 'react'
import { DEFAULT_PRICES } from '../content/balance'
import { isLiftRunning, liftStaffRequired, staffCount } from '../game/resort'
import { getLiftSite, getTrailDef } from '../game/trails'
import { useStore } from '../state/store'
import type { GameState } from '../game/types'

interface Step {
  id: string
  title: string
  body: string
  done: (game: GameState, ui: { selection: unknown; bottomTab: string | null }) => boolean
}

const STEPS: Step[] = [
  {
    id: 'inspect',
    title: 'Look around the mountain',
    body: 'Drag to move around and pinch to zoom on your phone. Tap a trail, lift, or building to inspect it. Tips advance when you do the action, or tap Next tip to read ahead. The carpet and two green runs are already built.',
    done: (_g, ui) => ui.selection !== null,
  },
  {
    id: 'starter-lift',
    title: 'Start with the beginner runs',
    body: 'The starter carpet is built but starts closed. Tap it, then tap Open lift. Your starting operator can run it. Check that its green trails say Open, then use Open the resort to welcome skiers — you can try the basic runs before building a chairlift.',
    done: (g) => Object.values(g.lifts).some((lift) => getLiftSite(g, lift.siteId).prebuilt && isLiftRunning(g, lift.siteId)),
  },
  {
    id: 'build-lift',
    title: 'String a lift up the hill',
    body: 'Open Build → pick a Fixed-grip chairlift, then tap a BOTTOM terminal near the village (rings snap to stations) and tap a TOP spot up the mountain. Higher means more vertical — and a pricier line.',
    done: (g) => Object.keys(g.lifts).length >= 2,
  },
  {
    id: 'open-trail',
    title: 'Give them a way down',
    body: 'In Build → Trails, pick “Draw a custom trail”: start at your new top station, tap waypoints downhill to a base station, then tap Cut this trail to finish. Gentle zigzags grade green; the fall line grades black. On Mount Alder you can also cut a surveyed corridor.',
    // every mountain starts with two prebuilt greens — any third trail counts
    done: (g) =>
      Object.values(g.trails).filter((t) => t.built).length > 2 ||
      Object.values(g.trails).some((t) => t.built && getTrailDef(g, t.trailId).difficulty !== 'green'),
  },
  {
    id: 'hire-staff',
    title: 'Staff the lifts',
    body: 'A chairlift needs 2 operators (the carpet needs 1). Open Staff and hire enough lift operators — unstaffed lifts don’t spin, and the morning alert will call it out.',
    done: (g) => staffCount(g, 'lift-ops') >= liftStaffRequired(g) && liftStaffRequired(g) > 0,
  },
  {
    id: 'rentals',
    title: 'Gear up the crowd',
    body: 'Nearly half of guests arrive without skis — no rental gear and they turn around at the ticket window. Build a Rental shop, hire a couple of rental staff. Short on cash? Finance offers an operating loan.',
    done: (g) => Object.values(g.facilities).includes('rental-shop') && staffCount(g, 'rental') > 0,
  },
  {
    id: 'set-price',
    title: 'Set your ticket price',
    body: 'Open Pricing. The valley benchmark is ~$55 — price above it and demand thins; below it and you leave money on the table.',
    done: (g) =>
      g.prices.adultTicket !== DEFAULT_PRICES.adultTicket ||
      g.prices.childTicket !== DEFAULT_PRICES.childTicket ||
      g.prices.foodLevel !== DEFAULT_PRICES.foodLevel,
  },
  {
    id: 'open-resort',
    title: 'Open the resort',
    body: 'Tap “Open the resort” in the top bar. Opening the resort does not open closed lifts. If guests leave without skiing, check that the carpet and its trails are open, the lift has an operator, and rental gear is available. Tap a guest to inspect their memories.',
    done: (g) => g.phase !== 'planning' || g.day > 1,
  },
  {
    id: 'watch-alerts',
    title: 'Keep an eye on operations',
    body: 'Wind holds, breakdowns, and incidents land in Alerts at the bottom. Open the Alerts tab to stay ahead of trouble.',
    done: (_g, ui) => ui.bottomTab === 'alerts',
  },
  {
    id: 'day-report',
    title: 'Close out the day',
    body: 'At 16:30 the mountain empties and the daily report settles the books. Survive to Day 2 and start growing — one day, more mountains (see the Resorts tab).',
    done: (g) => g.reports.length >= 1,
  },
]

export function Tutorial() {
  const game = useStore((s) => s.game)
  const selection = useStore((s) => s.selection)
  const bottomTab = useStore((s) => s.bottomTab)
  const panelOpen = useStore((s) => !!(s.selection || s.leftTab || s.bottomTab || s.buildMode || s.showReport))
  const completeTutorialStep = useStore((s) => s.completeTutorialStep)
  const skipTutorial = useStore((s) => s.skipTutorial)
  useStore((s) => s.tickCount)

  const active = game?.tutorialActive ?? false
  const current = active && game ? STEPS.find((s) => !game.tutorialDone.includes(s.id)) : undefined
  const isDone = current && game ? current.done(game, { selection, bottomTab }) : false

  useEffect(() => {
    if (current && isDone) {
      completeTutorialStep(current.id)
    }
  }, [current, isDone, completeTutorialStep])

  if (!game || !active || !current) return null
  const index = STEPS.indexOf(current)

  return (
    <div aria-label="Getting started" className={`pointer-events-auto absolute bottom-[var(--hud-content-bottom,64px)] right-3 z-20 w-[min(270px,calc(100vw-96px))] sm:left-20 sm:right-auto sm:w-[270px] ${panelOpen ? 'hidden' : ''}`}>
      <div className="glass max-h-[calc(100dvh-var(--hud-content-top,116px)-var(--hud-content-bottom,64px))] overflow-y-auto overscroll-contain rounded-2xl border-l-4 !border-l-pine p-3.5 rise-in" key={current.id}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-pine">
            Getting started · {index + 1}/{STEPS.length}
          </span>
        </div>
        <h4 className="font-display mt-1 text-[15px] font-semibold">{current.title}</h4>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{current.body}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-primary min-h-11 flex-1" onClick={() => completeTutorialStep(current.id)}>
            {index === STEPS.length - 1 ? 'Finish tips' : 'Next tip'}
          </button>
          <button className="btn btn-ghost min-h-11" onClick={skipTutorial}>
            Skip tutorial
          </button>
        </div>
      </div>
    </div>
  )
}
