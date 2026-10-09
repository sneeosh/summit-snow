/** Player-facing release history. Add new releases first; keep save versions separate. */
export const RELEASES = [
  {
    version: '0.1.2',
    date: '2026-10-09',
    dateLabel: 'October 9, 2026',
    title: 'Mountain display recovery and bug reports',
    summary: 'Lower memory use when switching views, with a way to report problems from anywhere in the game.',
    changes: [
      'Release mountain terrain images when leaving the view to prevent memory building up over repeated visits.',
      'Recover an interrupted mountain display without resetting your current game.',
      'Report bugs from the menu, mountain, or town, and download a diagnostic save to share when needed.',
    ],
  },
  {
    version: '0.1.1',
    date: '2026-09-06',
    dateLabel: 'September 6, 2026',
    title: '📱 Easier first steps on mobile',
    summary: 'Clearer tutorial controls and guidance for your first ski runs.',
    changes: [
      '👉 Move through tips with a larger Next tip button, or choose Skip tutorial.',
      '📱 Tutorial cards leave room for controls and panels, including when your phone is sideways.',
      '🎿 Learn how to open the starter carpet and get guests skiing before expanding.',
    ],
  },
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
