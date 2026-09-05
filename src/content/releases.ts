/** Player-facing release history. Add new releases first; keep save versions separate. */
export const RELEASES = [
  {
    version: '0.1.0',
    date: '2026-09-05',
    dateLabel: 'September 5, 2026',
    title: '🏘️ A livelier mountain town',
    summary: 'Growing villages, distinct mountains, and more ways to run your resort.',
    changes: [
      '🏡 Grow your village with homes, an inn, a shuttle, and Main Street improvements. Work with the council and revisit openings in the village scrapbook.',
      '❄️ Watch snow fall, neighbors stroll, and cars pass through town.',
      '🏔️ Explore eight mountains with distinct terrain, scenery, and operating goals.',
      '🌙 Run evening skiing at Prairie Knob and manage avalanche control on alpine terrain.',
      '🚁 Watch patrol respond to serious accidents, including helicopter evacuations and their operating costs.',
      '✨ Enjoy clearer town layouts and menus on smaller screens. Continue season now opens your newest save.',
    ],
  },
] as const

export const GAME_VERSION = RELEASES[0].version
