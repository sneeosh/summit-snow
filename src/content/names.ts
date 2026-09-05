/** Name pools and review/feedback copy. Flavour lives here, not in systems. */
import type { GuestMemory, SkillLevel } from '../game/types'

export const FIRST_NAMES = [
  'Avery', 'Bea', 'Callum', 'Dana', 'Eli', 'Freya', 'Gus', 'Harper', 'Ida', 'Jonas',
  'Kira', 'Lena', 'Marco', 'Nadia', 'Otis', 'Priya', 'Quinn', 'Rosa', 'Sam', 'Tessa',
  'Umberto', 'Vera', 'Wes', 'Ximena', 'Yuki', 'Zoe', 'Anders', 'Britt', 'Cole', 'Dot',
  'Emmett', 'Flora', 'Gwen', 'Hank', 'Ines', 'Jude', 'Kai', 'Lou', 'Mabel', 'Nico',
]

export const LAST_NAMES = [
  'Alderman', 'Birch', 'Calloway', 'Drummond', 'Eastwood', 'Fjeld', 'Grantham', 'Holt',
  'Iverson', 'Jensen', 'Kowalski', 'Lindqvist', 'Moreau', 'Nakamura', 'Okafor', 'Petrov',
  'Quist', 'Ramirez', 'Sorensen', 'Tanaka', 'Underhill', 'Voss', 'Winters', 'Yaeger', 'Zimmer',
]

/** Complaint/compliment copy keyed by memory kind, used for reports & reviews. */
export const MEMORY_COPY: Record<string, { good: boolean; report: string }> = {
  'deep-snow': { good: false, report: 'Deep snow was difficult for learners' },
  'powder-run': { good: true, report: 'Fresh powder runs' },
  'groomed-run': { good: true, report: 'Perfect corduroy grooming' },
  'scenic-run': { good: true, report: 'Beautiful views on the trails' },
  'good-meal': { good: true, report: 'Great food on the mountain' },
  'cozy-lodge': { good: true, report: 'Cozy base lodge' },
  'quick-lines': { good: true, report: 'Short lift lines' },
  'great-lesson': { good: true, report: 'Helpful ski school' },
  'fast-lift': { good: true, report: 'Fast, comfortable lifts' },
  'long-line': { good: false, report: 'Long lift lines' },
  'icy-trail': { good: false, report: 'Icy, scraped-off trails' },
  'thin-cover': { good: false, report: 'Thin snow coverage' },
  'crowded-trail': { good: false, report: 'Crowded trails' },
  'no-food': { good: false, report: 'Nowhere to eat' },
  'no-restroom': { good: false, report: 'No restrooms' },
  'expensive': { good: false, report: 'Prices felt steep' },
  'cold-wait': { good: false, report: 'Freezing waits with nowhere to warm up' },
  'nothing-to-ski': { good: false, report: 'Not enough terrain open' },
  'wrong-terrain': { good: false, report: 'No trails for my ability' },
  'injury': { good: false, report: 'Safety concerns on the hill' },
  'breakdown': { good: false, report: 'Lift breakdowns' },
  'no-rental': { good: false, report: 'Couldn’t rent equipment' },
  'stuck-trail': { good: false, report: 'Runs that climb back uphill' },
  'stranded': { good: false, report: 'Runs that dead-end mid-mountain' },
}

interface ReviewTemplate {
  minSat: number
  maxSat: number
  texts: string[]
}

export const REVIEW_TEMPLATES: ReviewTemplate[] = [
  {
    minSat: 85,
    maxSat: 101,
    texts: [
      'Unforgettable day. {highlight} — we’re already planning the next trip.',
      'Five stars isn’t enough. {highlight}. Mount Alder is a gem.',
      '{highlight}. Staff were lovely, snow was lovelier.',
    ],
  },
  {
    minSat: 65,
    maxSat: 85,
    texts: [
      'Really solid day on the hill. {highlight}, though {lowlight} needs attention.',
      'Good vibes at Mount Alder. {highlight}. Minor gripe: {lowlight}.',
      'Would come back. {highlight}.',
    ],
  },
  {
    minSat: 40,
    maxSat: 65,
    texts: [
      'Mixed feelings. {highlight}, but {lowlight} let the day down.',
      'Some good moments, but {lowlight} needs work.',
      'An okay day — {lowlight} took the shine off it.',
    ],
  },
  {
    minSat: 0,
    maxSat: 40,
    texts: [
      'Disappointed. {lowlight} ruined it. Hard to recommend right now.',
      'Not worth it today — {lowlight} was the story of our visit.',
      'Save your money until they sort out {lowlight}.',
    ],
  },
]

/** highlights are full clauses; they open or stand alone in a sentence */
const HIGHLIGHT_TEXT: Record<string, string> = {
  'powder-run': 'the powder was incredible',
  'groomed-run': 'the grooming was immaculate',
  'scenic-run': 'the views from the ridge are stunning',
  'good-meal': 'lunch hit the spot',
  'cozy-lodge': 'the lodge is genuinely cozy',
  'quick-lines': 'we barely waited for lifts',
  'great-lesson': 'the lesson was worth every penny',
  'fast-lift': 'the lifts are quick and smooth',
}

/** lowlights are noun phrases so they slot into any template position */
const LOWLIGHT_TEXT: Record<string, string> = {
  'long-line': 'the endless lift lines',
  'icy-trail': 'the sheet ice everywhere',
  'thin-cover': 'the bare patches and rocks',
  'crowded-trail': 'the mobbed trails',
  'no-food': 'the total lack of food',
  'no-restroom': 'the missing restrooms',
  expensive: 'the silly prices',
  'cold-wait': 'the freezing waits',
  'nothing-to-ski': 'how little was open',
  'wrong-terrain': 'the lack of terrain for our level',
  injury: 'the safety situation',
  breakdown: 'the unreliable lifts',
  'no-rental': 'the rental situation',
  'stuck-trail': 'the run that climbs uphill',
  stranded: 'getting stranded mid-mountain',
}

export function renderReview(
  template: string,
  bestMemory: GuestMemory | null,
  worstMemory: GuestMemory | null,
): string {
  const hl = bestMemory ? (HIGHLIGHT_TEXT[bestMemory.kind] ?? 'the mountain itself delivers') : 'the mountain itself delivers'
  const ll = worstMemory ? (LOWLIGHT_TEXT[worstMemory.kind] ?? 'a few rough edges') : 'a few rough edges'
  let out = template.replace('{highlight}', hl).replace('{lowlight}', ll)
  out = out.charAt(0).toUpperCase() + out.slice(1)
  return out
}

/** names handed out to player-drawn trails, in order of creation */
export const CUSTOM_TRAIL_NAMES = [
  'Jackrabbit',
  'Sluice Box',
  'Wanderer',
  'Snow Ghost',
  'Sidewinder',
  'Lucky Find',
  'Moose Alley',
  'Whiteout',
  'Falline',
  'Long Way Home',
  'Second Thoughts',
  'Widowmaker',
]

/** names for player-placed lifts, in order of creation */
export const CUSTOM_LIFT_NAMES = [
  'Eagle Chair',
  'Sunrise Express',
  'Ridge Runner',
  'Timber Flyer',
  'Bluebird Chair',
  'Highline',
  'Snowfield Shuttle',
  'Backbowl Express',
]

export const SKILL_LABEL: Record<SkillLevel, string> = {
  'first-timer': 'First-timer',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
}
