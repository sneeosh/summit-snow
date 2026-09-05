# Patrol rescue and helicopter evacuation

Addresses issue #7 on top of PRs #8–#10.

Serious incidents now hold the injured skier at the accident location. A visible
stretcher, leg splint, safety perimeter and patroller show the response. Patrol
arrives in six simulated minutes at 80% coverage or above, otherwise twelve.
After five minutes of stabilization, transport takes eight minutes. A sled takes
the guest to first aid (or base if none exists). Compound fractures use a helicopter
that approaches, loads and evacuates the guest from the resort.

35% of serious incidents require helicopter evacuation. Dispatch automatically
charges $4,500 to company cash, even if that requires an overdraft. This is a
fictional gameplay cost. The daily report includes it once under Helicopter
evacuations; ordinary sled work is covered by patrol payroll. Mountain operations
shows each rescue's injury, trail, status and cost. Minor incidents retain the
existing base/first-aid handling.

Rescue animation follows simulation time, so pause freezes it and speed controls
advance it. Reduced-motion mode shows stationary rescue symbols while the status
and simulation continue. Rendering consumes no RNG. Rescues complete before the
closing sweep can remove their guests. Day skipping uses the same tick lifecycle.

Save v12 adds daily rescue records, migrating active and inactive v11 holdings
with empty history and no invented charges. Existing older migrations chain through
v12. In-progress rescues retain their dispatch cost and timeline across save/load.
Records reset the next morning; financial reports retain historical costs.

Validation: 134 tests pass, including dispatch across all eight mountains,
no-cash dispatch, duplicate prevention, accounting, sled completion, late-day
rescue completion, live versus skipped days, serialization, and save migration.
Production build passes; lint has the two existing Fast Refresh warnings. Browser
animation and layout QA are pending because no browser is available in this session.
Balancing the new evacuation cost requires playtesting. Injury depiction is stylized
with a splint and stretcher, not anatomically detailed.
