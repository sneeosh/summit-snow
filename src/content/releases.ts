/** Player-facing release history. Add new releases first; keep save versions separate. */
export const RELEASES = [
  {
    version: '0.3.0-preview.3', date: '2026-09-05', dateLabel: 'September 5, 2026',
    title: '🎨 Make It Yours', summary: 'Your colors. Your celebrations. Your winter memories.',
    changes: [
      '✨ Clearer readiness checks, searchable guest stories, staggered commutes, and saved simulation speed.',
      '🎨 Name your resort, lifts, and trails. Choose village colors and lanterns or bunting in Resort journal → Customize.',
      '🎉 Host First Tracks Day, Local Race Day, or a Winter Festival. Plan around their requirements, pay a booking fee, and earn reputation by meeting the goal.',
      '📷 Download a village postcard with your resort name and season achievements. Season-end postcards are preserved automatically.',
      '🎿 Includes all Guests & Village features from the 0.2 preview.',
      '🧪 Preview build for playtesting; event balance is ready for your feedback.',
    ],
  },
  {
    version: '0.2.0-preview.1', date: '2026-09-05', dateLabel: 'September 5, 2026',
    title: '🎿 Guests & Village', summary: 'Every visit has a story. Follow it from arrival to the last run.',
    changes: [
      '📖 Open Resort journal for a morning briefing with visitor forecasts, yesterday’s results, and actions to review.',
      '🎯 Guests arrive with learning, challenge, exploration, or leisure goals that shape trail choices. Completing a goal improves satisfaction.',
      '⏱️ Follow live visit timelines through rentals, lessons, lifts, meals, and departures. Review the latest 24 departures each day.',
      '🚌 Completed village projects connect to guest origins, shuttle service, and staff commutes that follow the simulation clock.',
      '🧪 Preview build for playtesting; your production save stays on the production website.',
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
