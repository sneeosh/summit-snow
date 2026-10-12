# Winter strategy probe

Real scenario starting cash ($80,000), unmodified weather. Terrain takes the existing expansion loan; other strategies wait for earned cash. Each uses staffed rentals, $45 adult tickets, active snow management, then conditional investments. Policies are explicit in scripts/winter-strategies.ts. These are heuristic strategies, not optimal players. Results include debt service in cash; profit is operating profit.

| Seed | Strategy | Last day | Cash | Operating profit | Arrivals | Mean daily satisfaction | Setback / recovery | Runs / town upgrades | Finale |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| 11 | learners | 60 | 323269 | 495263 | 16275 | 78.3 | 24 / 25 | 3 / 0 | success |
| 11 | terrain | 60 | 337977 | 577517 | 22766 | 81.8 | 10 / 17 | 4 / 0 | success |
| 11 | village | 60 | 62522 | 254520 | 10044 | 76.2 | 58 / — | 3 / 4 | success |
| 42 | learners | 60 | 258006 | 475001 | 16033 | 73.6 | 8 / 10 | 3 / 0 | success |
| 42 | terrain | 60 | 256576 | 541111 | 22201 | 75.1 | 7 / 12 | 4 / 0 | success |
| 42 | village | 60 | 47502 | 239494 | 9732 | 72.9 | 60 / — | 3 / 4 | success |
| 91 | learners | 60 | 323094 | 495090 | 16480 | 79.2 | 17 / 18 | 3 / 0 | success |
| 91 | terrain | 60 | 271776 | 511313 | 21495 | 82.7 | 7 / 13 | 4 / 0 | missed |
| 91 | village | 60 | 34416 | 214416 | 9300 | 76.2 | 47 / 48 | 3 / 4 | success |
