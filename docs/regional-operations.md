# Regional operations — follow-up PR

This change stacks on the mountain-identity PR (#8). It adds three player-facing features and save format v9. Existing resorts keep their geometry; lighting and night hours start disabled. Saved inactive holdings migrate too.

## Prairie evenings

Open **Mountain** in the bottom toolbar during morning planning. Buy the hill-wide floodlight network for $45,000, then enable night skiing. The hill closes at 8:30 p.m.; arrivals resume between 4:30 and 7:30 p.m., targeting an additional 35% of daytime demand. Evening guests use the existing ticket prices and facilities. Hours are locked after opening and remain selected for subsequent days until changed during planning.

A night shift adds four hours of payroll (50% above the standard day), four hours of lift energy, and $360 for lighting. Floodlight capital contributes to resale development value. Day-end skipping runs the same extended simulation; the next morning resets the clock. Floodlit pistes and windows brighten as the terrain fades into dusk.

## Alpine avalanche control

Kea, Wasatch and Blanche assess built black and double-black runs using three-day snowfall, today's wind exposure and thaw. High-risk terrain closes before guests arrive. Greens and blues are unaffected. This initial system models preventive closures and control work, not destructive slides or evacuation scenes.

The Mountain tab shows risk, holds and clearance. Before opening, three patrollers can complete control for $650 per high-risk run. Control is charged immediately and shown once under **Mountain control** in the daily accounts. Clearance applies only to the runs actually assessed and expires the next morning. New terrain cut after control needs its own clearance. Cleared trails remain closed until the player reopens them, subject to sufficient snow. Leaving terrain closed avoids control costs.

## Village activity

Chimney smoke drifts above lodges and food venues. Staffed food, rental and school venues attract small animated village groups as attendance grows. Parked cars, benches and mugs add detail; lighting responds to evening hours. These are decorative scenes, not extra guests charged or counted by the simulation. Animation uses deterministic appearance hashes and never consumes simulation randomness. It refreshes at 10 Hz without rebuilding the static mountain.

## Validation and limits

Regression coverage includes evening arrivals and cutoff, deterministic night-day completion, overtime, lighting capital, failed actions remaining atomic, expert holds, paid staffed control, daily expiry, new-terrain clearance, expense accounting, and v8 active/inactive save migration. Production build and the regression suite pass.

Interactive visual QA remains pending because browser preview access is blocked. A standalone Canvas rendering attempt also could not complete because the installed renderer requires WebGL initialization. No image from that attempt is represented as a verified scene. Broader economic balancing of night shifts and patrol staffing remains playtest work. Nothing is deployed by this PR.
