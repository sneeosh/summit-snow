# Winter strategy probe

Real scenario starting cash ($80,000), unmodified weather. Terrain takes the existing expansion loan; other strategies wait for earned cash. Each uses staffed rentals, $45 adult tickets, active snow management, then conditional investments. Policies are explicit in scripts/winter-strategies.ts. These are heuristic strategies, not optimal players. Results include debt service in cash; profit is operating profit.

| Seed | Strategy | Last day | Cash | Operating profit | Arrivals | Mean daily satisfaction | Setback / recovery | Runs / town upgrades | Finale |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| 11 | learners | 60 | 300637 | 472627 | 15571 | 79.9 | 24 / 42 | 3 / 0 | success |
| 11 | terrain | 60 | 358969 | 598508 | 22767 | 81.5 | 10 / 17 | 4 / 0 | missed |
| 11 | village | 60 | 56704 | 331700 | 11544 | 77.4 | 51 / — | 3 / 4 | success |
| 42 | learners | 60 | 378783 | 595782 | 18188 | 73.8 | 8 / 10 | 3 / 0 | success |
| 42 | terrain | 60 | 324612 | 609148 | 22414 | 75.0 | 7 / 12 | 4 / 0 | success |
| 42 | village | 60 | 73051 | 348045 | 11681 | 73.9 | 47 / — | 3 / 5 | success |
| 91 | learners | 60 | 342648 | 514646 | 16970 | 79.7 | 17 / 18 | 3 / 0 | success |
| 91 | terrain | 60 | 274511 | 514049 | 21400 | 82.5 | 7 / 13 | 4 / 0 | missed |
| 91 | village | 60 | 41023 | 316024 | 11138 | 78.0 | 55 / — | 3 / 4 | success |
