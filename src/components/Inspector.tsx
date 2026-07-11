/** Contextual right-side inspector for the current selection. */
import { FACILITIES, LIFT_BASE_COST, LIFT_COST_PER_M, LIFT_TYPES, TRAIL_MIN_DEPTH_CM } from '../content/balance'
import { NODE_MAP, SLOT_MAP } from '../content/mountain'
import { getLiftSite, getTrailDef } from '../game/trails'
import { SKILL_LABEL } from '../content/names'
import { isLiftRunning } from '../game/resort'
import { formatMoney, useStore } from '../state/store'
import { DiffBadge, Meter, satColor } from './shared'

export function Inspector() {
  const game = useStore((s) => s.game)
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  if (!game || !selection) return null

  return (
    <div className="pointer-events-auto absolute right-3 top-20 z-20 w-[min(290px,calc(100vw-24px))]">
      <div className="glass scroll-thin max-h-[calc(100vh-100px)] overflow-y-auto rounded-2xl p-3.5 rise-in">
        <button
          className="absolute right-2.5 top-2 rounded-md px-1.5 text-[14px] text-ink-faint hover:bg-ink/6 hover:text-ink"
          onClick={() => select(null)}
        >
          ×
        </button>
        {selection.type === 'trail' && <TrailCard id={selection.id} />}
        {selection.type === 'lift' && <LiftCard id={selection.id} />}
        {selection.type === 'facility' && <FacilityCard id={selection.id} />}
        {selection.type === 'guest' && <GuestCard id={selection.id} />}
      </div>
    </div>
  )
}

const SURFACE_LABEL: Record<string, string> = {
  'fresh-powder': 'Fresh powder',
  'packed-powder': 'Packed powder',
  groomed: 'Groomed corduroy',
  firm: 'Firm',
  icy: 'Icy',
  thin: 'Thin cover',
  'wind-affected': 'Wind-affected',
}

function TrailCard({ id }: { id: string }) {
  const game = useStore((s) => s.game)!
  const setTrailOpen = useStore((s) => s.setTrailOpen)
  const installSnowmaking = useStore((s) => s.installSnowmaking)
  const buildTrail = useStore((s) => s.buildTrail)
  const def = getTrailDef(game, id)
  const st = game.trails[id]

  return (
    <div>
      <div className="flex items-center gap-2">
        <DiffBadge difficulty={def.difficulty} />
        <h3 className="panel-title">{def.name}</h3>
      </div>
      <div className="mt-0.5 text-[11px] text-ink-faint">
        {def.lengthM.toLocaleString()} m · {def.verticalM} m vert · {def.widthM} m wide
      </div>

      {!st.built ? (
        <div className="mt-3 space-y-2">
          <p className="text-[12px] text-ink-soft">A surveyed corridor, waiting for saws and cats.</p>
          <button className="btn btn-wood w-full" onClick={() => buildTrail(id)}>
            Cut trail — {formatMoney(def.buildCost)}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
            <span className="text-ink-faint">Status</span>
            <span className={`text-right font-semibold ${st.open ? 'text-diff-green' : 'text-safety'}`}>
              {st.open ? 'Open' : 'Closed'}
            </span>
            <span className="text-ink-faint">Surface</span>
            <span className="text-right font-medium">{SURFACE_LABEL[st.surface]}</span>
            <span className="text-ink-faint">Snow depth</span>
            <span className="text-right stat-number">{st.snowDepthCm} cm</span>
            <span className="text-ink-faint">Skiers now</span>
            <span className="text-right stat-number">
              {st.skierIds.length} <span className="text-ink-faint">/ {def.capacity}</span>
            </span>
            <span className="text-ink-faint">Runs today</span>
            <span className="text-right stat-number">{st.ridesToday}</span>
            <span className="text-ink-faint">Groomed</span>
            <span className="text-right">{st.groomedOvernight ? 'Overnight ✓' : '—'}</span>
          </div>

          {(def.totalClimbM ?? 0) > 2 && (
            <div className="rounded-lg bg-safety/10 px-2.5 py-1.5 text-[11px] font-medium text-safety">
              ⚠ Climbs {def.totalClimbM} m back uphill — skiers get stuck here.
            </div>
          )}
          {!NODE_MAP[def.bottomNodeId] && (
            <div className="rounded-lg bg-safety/10 px-2.5 py-1.5 text-[11px] font-medium text-safety">
              ⚠ Dead-ends mid-mountain — patrol sleds skiers out.
            </div>
          )}
          <button
            className={`btn w-full ${st.open ? 'btn-ghost' : 'btn-primary'}`}
            onClick={() => setTrailOpen(id, !st.open)}
          >
            {st.open ? 'Close trail' : `Open trail${st.snowDepthCm < TRAIL_MIN_DEPTH_CM ? ' (needs snow)' : ''}`}
          </button>
          {!st.hasSnowmaking && (
            <button className="btn btn-ghost w-full" onClick={() => installSnowmaking(id)}>
              Install snow guns — {formatMoney(12000)}
            </button>
          )}
          {st.hasSnowmaking && <div className="text-center text-[11px] text-diff-blue font-medium">❄ Snowmaking installed</div>}
        </div>
      )}
    </div>
  )
}

function LiftCard({ id }: { id: string }) {
  const game = useStore((s) => s.game)!
  const setLiftOpen = useStore((s) => s.setLiftOpen)
  const upgradeLift = useStore((s) => s.upgradeLift)
  const site = getLiftSite(game, id)
  const lift = game.lifts[id]
  if (!lift || !site) return null
  const spec = LIFT_TYPES[lift.kind]
  const running = isLiftRunning(game, id)
  const priceOf = (k: (typeof site.allowedKinds)[number]) =>
    site.isCustom ? LIFT_BASE_COST[k] + lift.lengthM * LIFT_COST_PER_M[k] : LIFT_TYPES[k].buildCost
  const upgrades = site.allowedKinds.filter((k) => priceOf(k) > priceOf(lift.kind))

  return (
    <div>
      <h3 className="panel-title">{site.name}</h3>
      <div className="mt-0.5 text-[11px] text-ink-faint">
        {spec.label} · {lift.lengthM.toLocaleString()} m · ride {lift.rideMinutes} min
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
        <span className="text-ink-faint">Status</span>
        <span className={`text-right font-semibold ${lift.forcedClosed ? 'text-safety' : running ? 'text-diff-green' : 'text-ink-soft'}`}>
          {lift.forcedClosed === 'wind'
            ? 'Wind hold'
            : lift.forcedClosed === 'breakdown'
              ? `Broken (${Math.ceil(lift.breakdownMinutesLeft)} min)`
              : running
                ? 'Spinning'
                : lift.open
                  ? 'Unstaffed'
                  : 'Closed'}
        </span>
        <span className="text-ink-faint">Capacity</span>
        <span className="text-right stat-number">{spec.hourlyCapacity}/hr</span>
        <span className="text-ink-faint">In line</span>
        <span className="text-right stat-number">{lift.queue.length}</span>
        <span className="text-ink-faint">Riding</span>
        <span className="text-right stat-number">{lift.riders.length}</span>
        <span className="text-ink-faint">Rides today</span>
        <span className="text-right stat-number">{lift.totalRidesToday.toLocaleString()}</span>
        <span className="text-ink-faint">Crew needed</span>
        <span className="text-right stat-number">{spec.staffRequired}</span>
        <span className="text-ink-faint">Wind limit</span>
        <span className="text-right stat-number">{spec.windTolerance} km/h</span>
      </div>
      <div className="mt-3 space-y-1.5">
        <button className={`btn w-full ${lift.open ? 'btn-ghost' : 'btn-primary'}`} onClick={() => setLiftOpen(id, !lift.open)}>
          {lift.open ? 'Close lift' : 'Open lift'}
        </button>
        {upgrades.map((k) => (
          <button key={k} className="btn btn-wood w-full" onClick={() => upgradeLift(id, k)}>
            Upgrade to {LIFT_TYPES[k].label} — {formatMoney(Math.max(0, Math.round(priceOf(k) - priceOf(lift.kind) * 0.5)))}
          </button>
        ))}
      </div>
    </div>
  )
}

function FacilityCard({ id }: { id: string }) {
  const game = useStore((s) => s.game)!
  const kind = game.facilities[id]
  if (!kind) return null
  const spec = FACILITIES[kind]
  const slot = SLOT_MAP[id]

  return (
    <div>
      <h3 className="panel-title">{spec.label}</h3>
      <div className="mt-0.5 text-[11px] text-ink-faint">{slot.id.startsWith('m') ? 'Mid-mountain' : 'Base village'}</div>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">{spec.description}</p>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
        <span className="text-ink-faint">Operating cost</span>
        <span className="text-right stat-number">{formatMoney(spec.operatingDaily)}/day</span>
        {spec.capacity > 0 && (
          <>
            <span className="text-ink-faint">Capacity</span>
            <span className="text-right stat-number">{spec.capacity}</span>
          </>
        )}
      </div>
    </div>
  )
}

const OBJECTIVE_LABEL: Record<string, string> = {
  arriving: 'Arriving',
  'buying-ticket': 'Buying a ticket',
  renting: 'Renting gear',
  walking: 'Wandering the base',
  'to-lift': 'Heading to a lift',
  queueing: 'Waiting in line',
  riding: 'Riding a lift',
  skiing: 'Skiing',
  eating: 'Eating',
  restroom: 'Restroom stop',
  resting: 'Warming up',
  'first-aid': 'In first aid',
  leaving: 'Heading home',
  gone: 'Gone',
}

function GuestCard({ id }: { id: number }) {
  const game = useStore((s) => s.game)!
  useStore((s) => s.tickCount) // live-update while sim runs
  const guest = game.guests[id]
  if (!guest) return <div className="text-[12px] text-ink-soft italic">They’ve headed home.</div>

  return (
    <div>
      <h3 className="panel-title">{guest.name}</h3>
      <div className="mt-0.5 text-[11px] text-ink-faint">
        {SKILL_LABEL[guest.skill]} · {guest.groupType.replace('-', ' ')}
        {guest.isChild ? ' · child' : ''}
      </div>
      <div className="mt-2 rounded-lg bg-ink/4 px-2.5 py-1.5 text-[12px] font-medium">
        {OBJECTIVE_LABEL[guest.objective]}
        {guest.routeTrailId ? ` — ${getTrailDef(game, guest.routeTrailId).name}` : ''}
        {guest.routeLiftId ? ` — ${getLiftSite(game, guest.routeLiftId).name}` : ''}
      </div>
      <div className="mt-2.5 space-y-1.5 text-[11px]">
        <BarRow label="Satisfaction" value={guest.satisfaction} color={satColor(guest.satisfaction)} />
        <BarRow label="Energy" value={guest.energy} color="var(--color-pine)" />
        <BarRow label="Warmth" value={guest.warmth} color="#c77f3d" />
        <BarRow label="Hunger" value={guest.hunger} color="#8a6d55" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
        <span className="text-ink-faint">Runs today</span>
        <span className="text-right stat-number">{guest.runsCompleted}</span>
        <span className="text-ink-faint">Spent</span>
        <span className="text-right stat-number">{formatMoney(guest.spent)}</span>
      </div>
      {guest.memories.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-wider text-ink-faint">Day so far</div>
          <ul className="scroll-thin mt-1 max-h-28 space-y-0.5 overflow-y-auto">
            {guest.memories.slice(-6).map((m, i) => (
              <li key={i} className="text-[11px] text-ink-soft">
                <span className={m.delta >= 0 ? 'text-diff-green' : 'text-safety'}>{m.delta >= 0 ? '▲' : '▼'}</span> {m.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function BarRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[76px] flex-none text-ink-faint">{label}</span>
      <Meter value={value} color={color} />
      <span className="stat-number w-7 flex-none text-right">{Math.round(value)}</span>
    </div>
  )
}
