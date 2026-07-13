/** Left-side construction & management toolbar: icon rail + active panel. */
import { useState } from 'react'
import {
  FACILITIES,
  LIFT_BASE_COST,
  LIFT_COST_PER_M,
  LIFT_TYPES,
  LOAN_OFFERS,
  SNOWMAKING_INSTALL_COST,
  STAFF_WAGES,
} from '../content/balance'
import { TRAILS } from '../content/mountain'
import { MOUNTAINS, snowfallLabel } from '../content/mountains'
import { saleValue } from '../game/company'
import { liftStaffRequired, staffCount } from '../game/resort'
import type { FacilityKind, LiftKind, StaffRole } from '../game/types'
import { formatMoney, useStore, type LeftTab, type Overlay } from '../state/store'
import { DiffBadge } from './shared'

const TABS: { id: LeftTab & string; icon: string; label: string }[] = [
  { id: 'build', icon: '🏗', label: 'Build' },
  { id: 'staff', icon: '🧑‍🔧', label: 'Staff' },
  { id: 'pricing', icon: '🎫', label: 'Pricing' },
  { id: 'finance', icon: '📒', label: 'Finance' },
  { id: 'resorts', icon: '🏔', label: 'Resorts' },
  { id: 'overlays', icon: '🗺', label: 'Views' },
]

export function LeftRail() {
  const leftTab = useStore((s) => s.leftTab)
  const setLeftTab = useStore((s) => s.setLeftTab)
  const mode = useStore((s) => s.game?.mode)
  // the scenario is a one-mountain story — no resort empire tab
  const tabs = mode === 'scenario' ? TABS.filter((t) => t.id !== 'resorts') : TABS

  return (
    <div className="pointer-events-auto absolute left-3 top-20 bottom-24 z-20 flex items-start gap-2">
      <div className="glass flex flex-col gap-1 rounded-2xl p-1.5">
        {tabs.map((t) => (
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
        <div className="glass flex max-h-full w-[min(300px,calc(100vw-90px))] flex-col rounded-2xl rise-in">
          <div className="flex flex-none items-center justify-between px-3.5 pb-1 pt-2.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-faint">
              {TABS.find((t) => t.id === leftTab)?.label}
            </span>
            <button
              className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-ink-faint transition-colors hover:bg-ink/6 hover:text-ink"
              title="Collapse panel"
              onClick={() => setLeftTab(null)}
            >
              « hide
            </button>
          </div>
          <div className="scroll-thin overflow-y-auto px-3.5 pb-3.5">
            {leftTab === 'build' && <BuildPanel />}
            {leftTab === 'staff' && <StaffPanel />}
            {leftTab === 'pricing' && <PricingPanel />}
            {leftTab === 'finance' && <FinancePanel />}
            {leftTab === 'resorts' && <ResortsPanel />}
            {leftTab === 'overlays' && <OverlaysPanel />}
          </div>
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

  const unbuiltTrails = TRAILS.filter((t) => !game.trails[t.id].built)
  const plumbable = TRAILS.filter((t) => game.trails[t.id].built && !game.trails[t.id].hasSnowmaking)

  return (
    <div className="space-y-4">
      <Section title="Lifts" hint="Pick a type, then click the bottom and top points anywhere on the mountain">
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(LIFT_TYPES) as LiftKind[]).map((kind) => {
            const spec = LIFT_TYPES[kind]
            const active = buildMode?.type === 'draw-lift' && buildMode.kind === kind
            return (
              <button
                key={kind}
                onClick={() => setBuildMode(active ? null : { type: 'draw-lift', kind, first: null })}
                className={`rounded-xl border p-2 text-left transition-colors ${
                  active ? 'border-wood bg-wood/10' : 'border-ink/10 hover:border-ink/25'
                }`}
              >
                <div className="text-[12px] font-semibold leading-tight">{spec.label}</div>
                <div className="stat-number text-[13px] text-wood">
                  {formatMoney(LIFT_BASE_COST[kind])} + {formatMoney(LIFT_COST_PER_M[kind])}/m
                </div>
                <div className="text-[10px] text-ink-faint">{spec.hourlyCapacity}/hr · {spec.staffRequired} ops</div>
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Trails" hint="Draw your own line, or cut a pre-surveyed corridor">
        <button
          onClick={() => setBuildMode(buildMode?.type === 'draw-trail' ? null : { type: 'draw-trail', points: [] })}
          className={`w-full rounded-xl border p-2 text-left transition-colors ${
            buildMode?.type === 'draw-trail' ? 'border-pine bg-pine/10' : 'border-ink/10 hover:border-ink/25'
          }`}
        >
          <div className="text-[12px] font-semibold">✏️ Draw a custom trail</div>
          <div className="text-[10px] text-ink-faint">
            Click waypoints down the mountain. You’ll pay to clear trees — and skiers will judge your line.
          </div>
        </button>
        {unbuiltTrails.length > 0 && (
          <>
            <button
              onClick={() => setBuildMode(buildMode?.type === 'trail' ? null : { type: 'trail' })}
              className={`mt-1.5 w-full rounded-xl border p-2 text-left transition-colors ${
                buildMode?.type === 'trail' ? 'border-diff-blue bg-diff-blue/10' : 'border-ink/10 hover:border-ink/25'
              }`}
            >
              <div className="text-[12px] font-semibold">Cut a surveyed corridor</div>
              <div className="text-[10px] text-ink-faint">Pre-cleared by the mountain planner:</div>
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
          </>
        )}
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

// ---------------------------------------------------------------- resorts

function ResortsPanel() {
  const game = useStore((s) => s.game)!
  const buy = useStore((s) => s.buyResort)
  const sell = useStore((s) => s.sellResort)
  const switchTo = useStore((s) => s.switchResortTo)
  // selling throws away everything built there — make them say it twice
  const [confirmSell, setConfirmSell] = useState<string | null>(null)

  const ownedIds = new Set(game.company.holdings.map((h) => h.mountainId))
  const operating = game.phase === 'operating'

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] leading-relaxed text-ink-soft">
        Company cash travels with you; each mountain keeps its own season. Buy cheap hills, build them out, sell up.
      </p>
      {MOUNTAINS.map((m) => {
        const owned = ownedIds.has(m.id)
        const active = m.id === game.mountainId
        const value = owned ? saleValue(game, m.id) : 0
        return (
          <div key={m.id} className={`rounded-xl border p-2.5 ${active ? 'border-pine bg-pine/5' : 'border-ink/10'}`}>
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-bold">{m.name}</span>
              {active && <span className="text-[9px] font-bold uppercase tracking-wider text-pine">Here now</span>}
              {owned && !active && <span className="text-[9px] font-bold uppercase tracking-wider text-wood">Owned</span>}
            </div>
            <div className="text-[10px] text-ink-faint">{m.region}</div>
            <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-ink-soft">
              <span>↕ {(m.topElev - m.baseElev).toLocaleString()} m</span>
              <span>❄ {snowfallLabel(m.climate.snowfallMult)}</span>
              <span>👥 ~{m.baseDemand}/day</span>
              <span>🌲 {m.treeDensity >= 0.8 ? 'Forested' : m.treeDensity >= 0.4 ? 'Gladed' : 'Open alpine'}</span>
            </div>
            <p className="mt-1 text-[10.5px] leading-snug text-ink-soft">{m.blurb}</p>
            <div className="mt-1.5 flex items-center justify-between">
              {!owned && (
                <>
                  <span className="stat-number text-[12px] text-wood">{formatMoney(m.price)}</span>
                  <button className="btn btn-primary !py-1 text-[11px]" disabled={game.cash < m.price} onClick={() => buy(m.id)}>
                    {game.cash < m.price ? 'Can’t afford' : 'Buy'}
                  </button>
                </>
              )}
              {owned && !active && (
                <>
                  <span className="text-[10.5px] text-ink-soft">
                    sells for <span className="stat-number">{formatMoney(value)}</span>
                  </span>
                  <span className="flex gap-1">
                    {confirmSell === m.id ? (
                      <>
                        <button
                          className="btn !py-1 text-[11px] !bg-[#c0392b] !text-white"
                          onClick={() => {
                            sell(m.id)
                            setConfirmSell(null)
                          }}
                        >
                          Sell for {formatMoney(value)}?
                        </button>
                        <button className="btn btn-ghost !py-1 text-[11px]" onClick={() => setConfirmSell(null)}>
                          Keep
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-ghost !py-1 text-[11px]" onClick={() => setConfirmSell(m.id)}>
                          Sell
                        </button>
                        <button
                          className="btn btn-primary !py-1 text-[11px]"
                          disabled={operating}
                          title={operating ? 'Close out the day first' : undefined}
                          onClick={() => switchTo(m.id)}
                        >
                          Go
                        </button>
                      </>
                    )}
                  </span>
                </>
              )}
              {active && (
                <span className="text-[10.5px] text-ink-faint">Switch away before selling this one.</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

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
