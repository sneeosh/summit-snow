/** Contextual, non-blocking tutorial: one nudge at a time, auto-advancing. */
import { useEffect } from 'react'
import { DEFAULT_PRICES } from '../content/balance'
import { liftStaffRequired, staffCount } from '../game/resort'
import { TRAIL_MAP } from '../content/mountain'
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
    body: 'Drag or use WASD to move around, scroll to zoom. Click any trail, lift, or building to inspect it. Meadow Carpet and the two green trails are already running.',
    done: (_g, ui) => ui.selection !== null,
  },
  {
    id: 'build-lift',
    title: 'Reach the mid-mountain',
    body: 'Open Build → pick a Fixed-grip chairlift, then click the dashed Alder Chair alignment. It unlocks the heart of the hill.',
    done: (g) => Boolean(g.lifts['alder-chair'] || g.lifts['summit-gondola']),
  },
  {
    id: 'open-trail',
    title: 'Cut an intermediate trail',
    body: 'In Build → Trails, choose “Cut a new trail”, then click the dotted Alder Run corridor. Blues bring the biggest crowd.',
    done: (g) => Object.values(g.trails).some((t) => t.built && TRAIL_MAP[t.trailId].difficulty === 'blue'),
  },
  {
    id: 'hire-staff',
    title: 'Staff the lifts',
    body: 'A chairlift needs 2 operators (the carpet needs 1). Open Staff and hire enough lift operators — unstaffed lifts don’t spin.',
    done: (g) => staffCount(g, 'lift-ops') >= liftStaffRequired(g) && liftStaffRequired(g) > 0,
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
    body: 'Hit “Open the resort” in the top bar. Guests arrive through the morning — watch them ride, ski, and spend.',
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
    body: 'At 16:30 the mountain empties and the daily report settles the books. Survive to Day 2 and start growing.',
    done: (g) => g.reports.length >= 1,
  },
]

export function Tutorial() {
  const game = useStore((s) => s.game)
  const selection = useStore((s) => s.selection)
  const bottomTab = useStore((s) => s.bottomTab)
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
    <div className="pointer-events-auto absolute bottom-6 left-3 z-20 w-[min(270px,calc(100vw-24px))]">
      <div className="glass rounded-2xl border-l-4 !border-l-pine p-3.5 rise-in" key={current.id}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-pine">
            Getting started · {index + 1}/{STEPS.length}
          </span>
          <button className="text-[10px] font-semibold text-ink-faint hover:text-ink" onClick={skipTutorial}>
            skip
          </button>
        </div>
        <h4 className="font-display mt-1 text-[15px] font-semibold">{current.title}</h4>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{current.body}</p>
      </div>
    </div>
  )
}
