/**
 * Narrative event system.
 *
 * Provider abstraction per the vision: the game is fully playable with the
 * deterministic LocalEventProvider; an LLM-backed provider can be dropped in
 * later behind the same interface. Freeform text NEVER touches game state —
 * every consequence flows through validated GameEffect objects.
 */
import { hashNoise } from './rng'
import { pushAlert } from './guests'
import type { EventCategory, GameEffect, GameState, ResortEvent } from './types'

// ------------------------------------------------------------- provider API

export interface EventContext {
  day: number
  seed: number
  reputation: number
  cash: number
  incidentsYesterday: number
  weatherSummary: string
  snowfallCm: number
  openTrailCount: number
  hasRestaurant: boolean
  staffMorale: number
}

export interface EventProvider {
  /** returns zero or more events for the dawning day (sync = deterministic) */
  generate(ctx: EventContext): ResortEvent[]
}

/**
 * Placeholder seam for an LLM-backed provider. Wire an API-backed
 * implementation here later; its output must still be parsed into the
 * ResortEvent/GameEffect schema (validateEffect) before touching the sim.
 */
export interface EventProviderConfig {
  provider: 'local' | 'llm'
  llmEndpoint?: string
}

export function createEventProvider(config: EventProviderConfig): EventProvider {
  if (config.provider === 'llm') {
    // LLM path intentionally falls back to local until an endpoint ships.
    console.warn('LLM event provider not configured — using LocalEventProvider')
  }
  return new LocalEventProvider()
}

// ---------------------------------------------------------------- templates

interface EventTemplate {
  id: string
  category: EventCategory
  title: string
  summary: string
  body: string
  /** eligibility gate */
  when: (ctx: EventContext) => boolean
  weight: number
  choices: { id: string; label: string; description: string; effects: GameEffect[] }[]
}

const TEMPLATES: EventTemplate[] = [
  {
    id: 'influencer-visit',
    category: 'community',
    title: 'Ski influencer wants a comp day',
    summary: '“PowderPriya” (480k followers) is asking for two comp tickets and a gondola photo op.',
    body: 'Her last resort feature tripled weekend bookings for a small hill in the next valley. She has… opinions… when she pays full price.',
    when: (ctx) => ctx.reputation >= 2 && ctx.day >= 3,
    weight: 1,
    choices: [
      {
        id: 'comp',
        label: 'Comp the tickets',
        description: 'Costs a little revenue, likely draws a crowd tomorrow.',
        effects: [
          { kind: 'cash', amount: -120 },
          { kind: 'demand-mult', amount: 1.35, duration: 1 },
        ],
      },
      {
        id: 'decline',
        label: 'Politely decline',
        description: 'Full price like everyone else.',
        effects: [{ kind: 'reputation', amount: -0.05 }],
      },
    ],
  },
  {
    id: 'school-trip',
    category: 'guest',
    title: 'School trip inquiry',
    summary: 'The valley middle school wants to bring 60 students at a group discount.',
    body: 'They can only afford about half your ticket price, but sixty kids learn to love the mountain — and their parents follow.',
    when: (ctx) => ctx.openTrailCount >= 2,
    weight: 1,
    choices: [
      {
        id: 'accept',
        label: 'Welcome them',
        description: 'A busy beginner hill today, goodwill for the season.',
        effects: [
          { kind: 'cash', amount: 1400 },
          { kind: 'demand-mult', amount: 1.15, duration: 1 },
          { kind: 'reputation', amount: 0.08 },
        ],
      },
      {
        id: 'decline',
        label: 'Decline',
        description: 'Keep the hill for paying guests.',
        effects: [],
      },
    ],
  },
  {
    id: 'gearbox-warning',
    category: 'safety',
    title: 'Worrying vibration on a lift gearbox',
    summary: 'A lift op reports a grinding note from the drive terminal.',
    body: 'An emergency inspection costs money and won’t find anything half the time. Ignoring it… usually goes fine.',
    when: (ctx) => ctx.day >= 4,
    weight: 0.9,
    choices: [
      {
        id: 'inspect',
        label: 'Pay for inspection ($1,800)',
        description: 'Peace of mind; the hill notices you take safety seriously.',
        effects: [
          { kind: 'cash', amount: -1800 },
          { kind: 'reputation', amount: 0.05 },
        ],
      },
      {
        id: 'ignore',
        label: 'Run it and monitor',
        description: 'Saves cash. Roll the dice on a breakdown.',
        effects: [{ kind: 'close-lift', amount: 0.35 }],
      },
    ],
  },
  {
    id: 'staff-raise',
    category: 'staff',
    title: 'Lift crew asks for cold-snap pay',
    summary: 'The morning crew wants a $500 team bonus for the brutal early shifts.',
    body: 'Morale on the loading ramps is the difference between “welcome back!” and thousand-yard stares.',
    when: (ctx) => ctx.day >= 5,
    weight: 0.8,
    choices: [
      {
        id: 'pay',
        label: 'Pay the bonus',
        description: 'Happier crew, warmer welcomes.',
        effects: [
          { kind: 'cash', amount: -500 },
          { kind: 'staff-morale', amount: 0.15 },
          { kind: 'satisfaction-all', amount: 2 },
        ],
      },
      {
        id: 'refuse',
        label: 'Not this month',
        description: 'The budget is the budget.',
        effects: [{ kind: 'staff-morale', amount: -0.12 }],
      },
    ],
  },
  {
    id: 'powder-alert',
    category: 'weather',
    title: 'Powder alert going viral',
    summary: 'Local forecasters are hyping tonight’s storm. Ski forums are buzzing about your mountain.',
    body: 'Storm chasers are gassing up. Expect a stampede if the forecast verifies.',
    when: (ctx) => ctx.snowfallCm >= 15,
    weight: 1.4,
    choices: [
      {
        id: 'lean-in',
        label: 'Post the stoke edit',
        description: 'Fan the flames — big crowd, big lines.',
        effects: [{ kind: 'demand-mult', amount: 1.4, duration: 1 }],
      },
      {
        id: 'quiet',
        label: 'Keep it quiet',
        description: 'Let the locals have their day.',
        effects: [
          { kind: 'demand-mult', amount: 1.1, duration: 1 },
          { kind: 'reputation', amount: 0.06 },
        ],
      },
    ],
  },
  {
    id: 'neighbor-noise',
    category: 'community',
    title: 'Neighbor complains about snow guns',
    summary: 'A homeowner below the resort boundary says the guns kept her up all night.',
    body: 'She’s threatening to raise it at the county board meeting.',
    when: (ctx) => ctx.day >= 6,
    weight: 0.6,
    choices: [
      {
        id: 'goodwill',
        label: 'Send a season pass and apology',
        description: 'Cheap diplomacy.',
        effects: [
          { kind: 'cash', amount: -300 },
          { kind: 'reputation', amount: 0.04 },
        ],
      },
      {
        id: 'dismiss',
        label: 'Snowmaking is survival',
        description: 'The county loves the winter economy more than quiet nights.',
        effects: [{ kind: 'reputation', amount: -0.08 }],
      },
    ],
  },
  {
    id: 'insurance-notice',
    category: 'financial',
    title: 'Insurance premium review',
    summary: 'Your insurer flagged this week’s incident report and wants a safety surcharge.',
    body: 'Pay the surcharge, or commit to a documented safety program (patrol staffing and first aid coverage).',
    when: (ctx) => ctx.incidentsYesterday >= 1,
    weight: 1.6,
    choices: [
      {
        id: 'pay',
        label: 'Pay the surcharge ($2,400)',
        description: 'Make it go away.',
        effects: [{ kind: 'cash', amount: -2400 }],
      },
      {
        id: 'program',
        label: 'Commit to the safety program',
        description: 'Cheaper, but the paperwork dings morale.',
        effects: [
          { kind: 'cash', amount: -800 },
          { kind: 'staff-morale', amount: -0.05 },
          { kind: 'reputation', amount: 0.05 },
        ],
      },
    ],
  },
  {
    id: 'restaurant-critic',
    category: 'guest',
    title: 'Food critic booked a table',
    summary: 'The valley paper’s food writer reserved lunch at your restaurant tomorrow.',
    body: 'A glowing column would put your kitchen on the map.',
    when: (ctx) => ctx.hasRestaurant,
    weight: 0.8,
    choices: [
      {
        id: 'special',
        label: 'Run a special menu ($600)',
        description: 'Impress the critic, charm the room.',
        effects: [
          { kind: 'cash', amount: -600 },
          { kind: 'reputation', amount: 0.12 },
          { kind: 'demand-mult', amount: 1.1, duration: 1 },
        ],
      },
      {
        id: 'normal',
        label: 'Serve the usual',
        description: 'The chili speaks for itself.',
        effects: [],
      },
    ],
  },
  {
    id: 'hotel-partnership',
    category: 'financial',
    title: 'Valley hotel proposes a package deal',
    summary: 'The valley inn wants to bundle lift tickets with rooms at a 15% cut.',
    body: 'Less per ticket, more guests midweek — their shuttle drops at your front door.',
    when: (ctx) => ctx.day >= 8 && ctx.reputation >= 2.2,
    weight: 0.7,
    choices: [
      {
        id: 'sign',
        label: 'Sign the deal',
        description: 'Steady demand bump, small revenue share.',
        effects: [
          { kind: 'demand-mult', amount: 1.2, duration: 3 },
          { kind: 'cash', amount: -400 },
        ],
      },
      {
        id: 'pass',
        label: 'Pass for now',
        description: 'Keep full ticket revenue.',
        effects: [],
      },
    ],
  },
]

// --------------------------------------------------------------- local impl

export class LocalEventProvider implements EventProvider {
  generate(ctx: EventContext): ResortEvent[] {
    const roll = hashNoise(ctx.seed, ctx.day, 991)
    // most days are quiet; some days one thing happens
    if (roll > 0.55) return []

    const eligible = TEMPLATES.filter((t) => t.when(ctx))
    if (eligible.length === 0) return []

    // deterministic weighted pick that varies day to day
    let total = 0
    for (const t of eligible) total += t.weight
    let cursor = hashNoise(ctx.seed, ctx.day, 313) * total
    let chosen = eligible[eligible.length - 1]
    for (const t of eligible) {
      cursor -= t.weight
      if (cursor <= 0) {
        chosen = t
        break
      }
    }

    return [
      {
        id: `${chosen.id}-d${ctx.day}`,
        title: chosen.title,
        category: chosen.category,
        summary: chosen.summary,
        body: chosen.body,
        choices: chosen.choices,
        expiresDay: ctx.day + 1,
        resolved: false,
        chosenId: null,
        day: ctx.day,
      },
    ]
  }
}

// ----------------------------------------------------------- effect engine

const EFFECT_KINDS = new Set([
  'cash',
  'reputation',
  'demand-mult',
  'staff-morale',
  'close-trail',
  'close-lift',
  'satisfaction-all',
  'snow-bonus',
])

export function validateEffect(e: GameEffect): boolean {
  return EFFECT_KINDS.has(e.kind) && Number.isFinite(e.amount)
}

/** Applies a validated effect list to the sim. Unknown kinds are dropped loudly. */
export function applyEffects(state: GameState, effects: GameEffect[]): void {
  for (const e of effects) {
    if (!validateEffect(e)) {
      console.warn('Dropping invalid game effect', e)
      continue
    }
    switch (e.kind) {
      case 'cash':
        state.cash += e.amount
        break
      case 'reputation':
        state.reputation = Math.max(0, Math.min(5, state.reputation + e.amount))
        break
      case 'demand-mult':
        state.demandMultTomorrow *= e.amount
        break
      case 'staff-morale':
        state.staffMorale = Math.max(0, Math.min(1, state.staffMorale + e.amount))
        break
      case 'satisfaction-all':
        for (const g of Object.values(state.guests)) {
          g.satisfaction = Math.max(0, Math.min(100, g.satisfaction + e.amount))
        }
        break
      case 'snow-bonus':
        state.snowBonusCm += e.amount
        break
      case 'close-lift': {
        // amount is a probability of a next-morning breakdown (deferred risk)
        if (hashNoise(state.seed, state.day, 577) < e.amount) {
          const lifts = Object.values(state.lifts).filter((l) => l.open)
          if (lifts.length > 0) {
            const lift = lifts[Math.floor(hashNoise(state.seed, state.day, 578) * lifts.length)]
            lift.forcedClosed = 'breakdown'
            lift.breakdownMinutesLeft = 180
            pushAlert(state, 'critical', 'That gearbox let go. Should have inspected it.')
          }
        }
        break
      }
      case 'close-trail': {
        const trail = e.targetId ? state.trails[e.targetId] : null
        if (trail) trail.open = false
        break
      }
    }
  }
}

export function resolveEvent(state: GameState, eventId: string, choiceId: string): void {
  const event = state.events.find((ev) => ev.id === eventId)
  if (!event || event.resolved) return
  const choice = event.choices.find((c) => c.id === choiceId)
  if (!choice) return
  event.resolved = true
  event.chosenId = choiceId
  applyEffects(state, choice.effects)
}

export function expireOldEvents(state: GameState): void {
  for (const ev of state.events) {
    if (!ev.resolved && state.day >= ev.expiresDay) {
      ev.resolved = true
      ev.chosenId = null
    }
  }
  // keep the log tidy
  if (state.events.length > 20) state.events.splice(0, state.events.length - 20)
}
