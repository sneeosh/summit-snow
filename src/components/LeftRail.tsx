/** Left-side construction & management toolbar: icon rail + active panel. */
import { FACILITIES, LIFT_TYPES, LOAN_OFFERS, SNOWMAKING_INSTALL_COST, STAFF_WAGES } from '../content/balance'
import { LIFT_SITES, TRAILS } from '../content/mountain'
import { liftStaffRequired, staffCount } from '../game/resort'
import type { FacilityKind, LiftKind, StaffRole } from '../game/types'
import { formatMoney, useStore, type LeftTab, type Overlay } from '../state/store'
import { DiffBadge } from './shared'

const TABS: { id: LeftTab & string; icon: string; label: string }[] = [
  { id: 'build', icon: '🏗', label: 'Build' },
  { id: 'staff', icon: '🧑‍🔧', label: 'Staff' },
  { id: 'pricing', icon: '🎫', label: 'Pricing' },
  { id: 'finance', icon: '📒', label: 'Finance' },
  { id: 'overlays', icon: '🗺', label: 'Views' },
]

export function LeftRail() {
  const leftTab = useStore((s) => s.leftTab)
  const setLeftTab = useStore((s) => s.setLeftTab)

  return (
    <div className="pointer-events-auto absolute left-3 top-20 bottom-24 z-20 flex items-start gap-2">
      <div className="glass flex flex-col gap-1 rounded-2xl p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            title={t.label}
            onClick={() => setLeftTab(leftTab === t.id ? null : t.id)}
            className={`flex h-11 w-11 flex-col items-center justify-center rounded-xl transition-colors ${
              leftTab === t.id ? 'bg-ink text-white' : 'hover:bg-ink/6 text-ink-soft'
            }`}
          >
            <span className="text-[16px] leading-none">{t.icon}</span>
            <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide">{t.label}</span>
          </button>
        ))}
      </div>

      {leftTab && (
        <div className="glass scroll-thin max-h-full w-[min(300px,calc(100vw-90px))] overflow-y-auto rounded-2xl p-3.5 rise-in">
          {leftTab === 'build' && <BuildPanel />}
          {leftTab === 'staff' && <StaffPanel />}
          {leftTab === 'pricing' && <PricingPanel />}
          {leftTab === 'finance' && <FinancePanel />}
          {leftTab === 'overlays' && <OverlaysPanel />}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ build

function BuildPanel() {
  const game = useStore((s) => s.game)!
  const buildMode = useStore((s) => s.buildMode)
  const setBuildMode = useStore((s) => s.setBuildMode)

  const unbuiltSites = LIFT_SITES.filter((s) => !game.lifts[s.id])
  const unbuiltTrails = TRAILS.filter((t) => !game.trails[t.id].built)
  const plumbable = TRAILS.filter((t) => game.trails[t.id].built && !game.trails[t.id].hasSnowmaking)

  return (
    <div className="space-y-4">
      <Section title="Lifts" hint={unbuiltSites.length === 0 ? 'Every alignment is built' : 'Pick a type, then click a dashed alignment on the map'}>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(LIFT_TYPES) as LiftKind[]).map((kind) => {
            const spec = LIFT_TYPES[kind]
            const active = buildMode?.type === 'lift' && buildMode.kind === kind
            const anySite = unbuiltSites.some((s) => s.allowedKinds.includes(kind))
            return (
              <button
                key={kind}
                disabled={!anySite}
                onClick={() => setBuildMode(active ? null : { type: 'lift', kind })}
                className={`rounded-xl border p-2 text-left transition-colors ${
                  active ? 'border-wood bg-wood/10' : 'border-ink/10 hover:border-ink/25'
                } ${!anySite ? 'opacity-40' : ''}`}
              >
                <div className="text-[12px] font-semibold leading-tight">{spec.label}</div>
                <div className="stat-number text-[13px] text-wood">{formatMoney(spec.buildCost)}</div>
                <div className="text-[10px] text-ink-faint">{spec.hourlyCapacity}/hr · {spec.staffRequired} ops</div>
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Trails" hint={unbuiltTrails.length === 0 ? 'All corridors cut' : 'Select, then click a dotted corridor'}>
        <button
          onClick={() => setBuildMode(buildMode?.type === 'trail' ? null : { type: 'trail' })}
          className={`w-full rounded-xl border p-2 text-left transition-colors ${
            buildMode?.type === 'trail' ? 'border-diff-blue bg-diff-blue/10' : 'border-ink/10 hover:border-ink/25'
          }`}
          disabled={unbuiltTrails.length === 0}
        >
          <div className="text-[12px] font-semibold">Cut a new trail</div>
          <div className="text-[10px] text-ink-faint">Corridors surveyed by the mountain planner:</div>
        </button>
        <div className="mt-1.5 space-y-1">
          {unbuiltTrails.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg bg-ink/4 px-2 py-1 text-[11px]">
              <span className="flex items-center gap-1.5 font-medium">
                <DiffBadge difficulty={t.difficulty} /> {t.name}
              </span>
              <span className="stat-number text-wood">{formatMoney(t.buildCost)}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Snowmaking" hint="Guns fire on cold nights; needs snowmaking techs">
        <button
          onClick={() => setBuildMode(buildMode?.type === 'snowmaking' ? null : { type: 'snowmaking' })}
          disabled={plumbable.length === 0}
          className={`w-full rounded-xl border p-2 text-left transition-colors ${
            buildMode?.type === 'snowmaking' ? 'border-diff-blue bg-diff-blue/10' : 'border-ink/10 hover:border-ink/25'
          } ${plumbable.length === 0 ? 'opacity-40' : ''}`}
        >
          <div className="text-[12px] font-semibold">Install snow guns — {formatMoney(SNOWMAKING_INSTALL_COST)}</div>
          <div className="text-[10px] text-ink-faint">Click a built trail to plumb it</div>
        </button>
      </Section>

      <Section title="Facilities" hint="Pick one, then click a highlighted site in the village">
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(FACILITIES) as FacilityKind[])
            .filter((k) => k !== 'base-lodge' && k !== 'ticket-office')
            .map((kind) => {
              const spec = FACILITIES[kind]
              const active = buildMode?.type === 'facility' && buildMode.kind === kind
              return (
                <button
                  key={kind}
                  onClick={() => setBuildMode(active ? null : { type: 'facility', kind })}
                  title={spec.description}
                  className={`rounded-xl border p-2 text-left transition-colors ${
                    active ? 'border-diff-green bg-diff-green/10' : 'border-ink/10 hover:border-ink/25'
                  }`}
                >
                  <div className="text-[12px] font-semibold leading-tight">{spec.label}</div>
                  <div className="stat-number text-[13px] text-wood">{formatMoney(spec.buildCost)}</div>
                  <div className="text-[10px] text-ink-faint">{formatMoney(spec.operatingDaily)}/day opex</div>
                </button>
              )
            })}
        </div>
      </Section>
    </div>
  )
}

// ------------------------------------------------------------------ staff

const ROLE_META: Record<StaffRole, { label: string; hint: string }> = {
  'lift-ops': { label: 'Lift operators', hint: 'Lifts don’t spin without a crew' },
  patrol: { label: 'Ski patrol', hint: 'Covers open trails; fewer serious incidents' },
  grooming: { label: 'Groomer operators', hint: 'Each grooms 2 trails overnight' },
  snowmaking: { label: 'Snowmaking techs', hint: 'Each runs guns on 2 trails' },
  rental: { label: 'Rental staff', hint: 'Serve gear renters (needs rental shop)' },
  instructors: { label: 'Instructors', hint: 'Teach lessons (needs ski school)' },
  'food-service': { label: 'Food service', hint: 'Staff the café, lodge & restaurant' },
  maintenance: { label: 'Mechanics', hint: 'Fewer lift breakdowns, faster repairs' },
}

function StaffPanel() {
  const game = useStore((s) => s.game)!
  const setStaffCount = useStore((s) => s.setStaffCount)
  const needOps = liftStaffRequired(game)
  const haveOps = staffCount(game, 'lift-ops')
  const payroll = game.staff.reduce((sum, d) => sum + d.headcount * d.dailyWage, 0)

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="panel-title">Departments</h3>
        <span className="text-[11px] text-ink-soft">
          payroll <span className="stat-number">{formatMoney(payroll)}/day</span>
        </span>
      </div>
      {needOps > haveOps && (
        <div className="rounded-lg bg-safety/10 px-2.5 py-1.5 text-[11px] font-medium text-safety">
          Lifts need {needOps} operators — some lifts can’t spin with {haveOps}.
        </div>
      )}
      {game.staff.map((dept) => (
        <div key={dept.role} className="rounded-xl border border-ink/8 p-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12px] font-semibold">{ROLE_META[dept.role].label}</div>
              <div className="text-[10px] text-ink-faint">{formatMoney(STAFF_WAGES[dept.role])}/day each</div>
            </div>
            <div className="flex items-center gap-1.5">
              <button className="btn btn-ghost !h-7 !w-7 !p-0" onClick={() => setStaffCount(dept.role, dept.headcount - 1)}>
                −
              </button>
              <span className="stat-number w-6 text-center text-[15px]">{dept.headcount}</span>
              <button className="btn btn-ghost !h-7 !w-7 !p-0" onClick={() => setStaffCount(dept.role, dept.headcount + 1)}>
                +
              </button>
            </div>
          </div>
          <div className="mt-1 text-[10px] italic text-ink-faint">{ROLE_META[dept.role].hint}</div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- pricing

function PricingPanel() {
  const game = useStore((s) => s.game)!
  const setPrices = useStore((s) => s.setPrices)
  const p = game.prices

  return (
    <div className="space-y-3">
      <h3 className="panel-title">Pricing</h3>
      <PriceRow label="Adult day ticket" value={p.adultTicket} step={2} onChange={(v) => setPrices({ adultTicket: v })} />
      <PriceRow label="Child day ticket" value={p.childTicket} step={2} onChange={(v) => setPrices({ childTicket: v })} />
      <PriceRow label="Equipment rental" value={p.rental} step={1} onChange={(v) => setPrices({ rental: v })} />
      <PriceRow label="Group lesson" value={p.lesson} step={5} onChange={(v) => setPrices({ lesson: v })} />
      <PriceRow label="Parking" value={p.parking} step={1} onChange={(v) => setPrices({ parking: v })} />
      <div>
        <div className="mb-1 text-[12px] font-semibold">Food & beverage level</div>
        <div className="flex gap-1">
          {(['Value', 'Standard', 'Premium'] as const).map((label, i) => (
            <button
              key={label}
              onClick={() => setPrices({ foodLevel: i + 1 })}
              className={`btn flex-1 ${p.foodLevel === i + 1 ? 'btn-primary' : 'btn-ghost'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-1 text-[10px] italic text-ink-faint">
          Premium food earns more per meal and delights guests — value fills bellies cheaply.
        </div>
      </div>
      <div className="rounded-lg bg-ink/4 px-2.5 py-2 text-[11px] text-ink-soft">
        Demand reacts to ticket price against the valley’s ~$55 benchmark, weather, reputation, and how much terrain is open.
      </div>
    </div>
  )
}

function PriceRow({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        <button className="btn btn-ghost !h-7 !w-7 !p-0" onClick={() => onChange(value - step)}>
          −
        </button>
        <span className="stat-number w-12 text-center text-[15px]">${value}</span>
        <button className="btn btn-ghost !h-7 !w-7 !p-0" onClick={() => onChange(value + step)}>
          +
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- finance

function FinancePanel() {
  const game = useStore((s) => s.game)!
  const takeLoan = useStore((s) => s.takeLoan)
  const rev = game.revenueToday
  const revTotal = rev.tickets + rev.rentals + rev.food + rev.lessons + rev.parking
  const last = game.reports[game.reports.length - 1]

  return (
    <div className="space-y-3">
      <h3 className="panel-title">Finance</h3>

      <div className="rounded-xl border border-ink/8 p-2.5">
        <div className="text-[10px] uppercase tracking-wider text-ink-faint">Today’s revenue</div>
        <div className="stat-number text-[20px]">{formatMoney(revTotal)}</div>
        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-ink-soft">
          <span>Tickets</span>
          <span className="text-right stat-number">{formatMoney(rev.tickets)}</span>
          <span>Food</span>
          <span className="text-right stat-number">{formatMoney(rev.food)}</span>
          <span>Rentals</span>
          <span className="text-right stat-number">{formatMoney(rev.rentals)}</span>
          <span>Lessons</span>
          <span className="text-right stat-number">{formatMoney(rev.lessons)}</span>
          <span>Parking</span>
          <span className="text-right stat-number">{formatMoney(rev.parking)}</span>
        </div>
      </div>

      {last && (
        <div className="rounded-xl border border-ink/8 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-ink-faint">Yesterday (Day {last.day})</div>
          <div className={`stat-number text-[16px] ${last.netProfit >= 0 ? 'text-diff-green' : 'text-safety'}`}>
            {last.netProfit >= 0 ? '+' : ''}
            {formatMoney(last.netProfit)} net
          </div>
          <div className="text-[11px] text-ink-soft">
            {last.guestsServed} guests · {last.avgSatisfaction}% satisfied
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 text-[12px] font-semibold">Financing</div>
        {LOAN_OFFERS.map((offer) => {
          const active = game.loans.find((l) => l.id === offer.id)
          return (
            <div key={offer.id} className="mb-1.5 rounded-xl border border-ink/8 p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[12px] font-semibold">{offer.label}</div>
                  <div className="text-[10px] text-ink-faint">
                    {formatMoney(offer.principal)} · {formatMoney(offer.dailyPayment)}/day · {(offer.dailyRate * 100).toFixed(2)}%/day
                  </div>
                </div>
                {active ? (
                  <span className="text-[11px] font-semibold text-ink-soft">
                    owes <span className="stat-number">{formatMoney(active.balance)}</span>
                  </span>
                ) : (
                  <button className="btn btn-ghost" onClick={() => takeLoan(offer.id)}>
                    Borrow
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- overlays

const OVERLAYS: { id: Overlay; label: string; hint: string }[] = [
  { id: 'none', label: 'Natural', hint: 'The mountain as guests see it' },
  { id: 'difficulty', label: 'Trail difficulty', hint: 'Ribbons tinted by rating' },
  { id: 'snow', label: 'Snow depth', hint: 'Orange = thin, deep blue = plenty' },
  { id: 'crowding', label: 'Crowding', hint: 'Where the hill is jammed right now' },
]

function OverlaysPanel() {
  const overlay = useStore((s) => s.overlay)
  const setOverlay = useStore((s) => s.setOverlay)
  return (
    <div className="space-y-1.5">
      <h3 className="panel-title mb-2">Map views</h3>
      {OVERLAYS.map((o) => (
        <button
          key={o.id}
          onClick={() => setOverlay(o.id)}
          className={`w-full rounded-xl border p-2.5 text-left transition-colors ${
            overlay === o.id ? 'border-ink bg-ink/6' : 'border-ink/10 hover:border-ink/25'
          }`}
        >
          <div className="text-[12px] font-semibold">{o.label}</div>
          <div className="text-[10px] text-ink-faint">{o.hint}</div>
        </button>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ shared

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="panel-title">{title}</h3>
      {hint && <div className="mb-1.5 text-[10px] italic text-ink-faint">{hint}</div>}
      {children}
    </div>
  )
}
