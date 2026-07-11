/** Collapsible bottom panel: alerts, guest census, finance history. */
import { formatClock, formatMoney, useStore } from '../state/store'
import { satColor } from './shared'

export function BottomPanel() {
  const game = useStore((s) => s.game)
  const tab = useStore((s) => s.bottomTab)
  const setTab = useStore((s) => s.setBottomTab)
  useStore((s) => s.tickCount)
  if (!game) return null

  const unreadCritical = game.alerts.filter((a) => a.day === game.day && a.severity !== 'info').length

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
      {tab && (
        <div className="glass mb-2 h-[190px] w-[640px] overflow-hidden rounded-2xl rise-in">
          {tab === 'alerts' && <AlertsTab />}
          {tab === 'guests' && <GuestsTab />}
          {tab === 'finance' && <FinanceTab />}
        </div>
      )}
      <div className="glass mx-auto flex w-fit items-center gap-1 rounded-2xl p-1.5">
        <TabButton label="Alerts" badge={unreadCritical || undefined} active={tab === 'alerts'} onClick={() => setTab(tab === 'alerts' ? null : 'alerts')} />
        <TabButton label="Guests" active={tab === 'guests'} onClick={() => setTab(tab === 'guests' ? null : 'guests')} />
        <TabButton label="Finances" active={tab === 'finance'} onClick={() => setTab(tab === 'finance' ? null : 'finance')} />
      </div>
    </div>
  )
}

function TabButton({ label, active, onClick, badge }: { label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button className={`btn relative ${active ? 'btn-primary' : 'btn-ghost'}`} onClick={onClick}>
      {label}
      {badge ? (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-safety px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  )
}

function AlertsTab() {
  const game = useStore((s) => s.game)!
  const alerts = [...game.alerts].reverse().slice(0, 30)
  return (
    <ul className="scroll-thin h-full space-y-0.5 overflow-y-auto p-3">
      {alerts.length === 0 && <li className="text-[12px] italic text-ink-faint">All quiet on the mountain.</li>}
      {alerts.map((a) => (
        <li key={a.id} className="flex items-baseline gap-2 rounded-lg px-2 py-1 text-[12px] hover:bg-ink/4">
          <span
            className={`inline-block h-2 w-2 flex-none translate-y-[-1px] rounded-full ${
              a.severity === 'critical' ? 'bg-safety pulse-dot' : a.severity === 'warning' ? 'bg-amber' : 'bg-snow-3'
            }`}
          />
          <span className="flex-none stat-number text-[11px] text-ink-faint">
            d{a.day} {formatClock(a.minute)}
          </span>
          <span className="text-ink-soft">{a.text}</span>
        </li>
      ))}
    </ul>
  )
}

function GuestsTab() {
  const game = useStore((s) => s.game)!
  const select = useStore((s) => s.select)
  const guests = Object.values(game.guests)
  const avgSat = guests.length ? guests.reduce((s, g) => s + g.satisfaction, 0) / guests.length : 0
  const byState = new Map<string, number>()
  for (const g of guests) byState.set(g.objective, (byState.get(g.objective) ?? 0) + 1)
  const skiing = byState.get('skiing') ?? 0
  const queueing = byState.get('queueing') ?? 0
  const riding = byState.get('riding') ?? 0

  return (
    <div className="flex h-full gap-3 p-3">
      <div className="w-44 flex-none space-y-1 border-r border-ink/8 pr-3 text-[12px]">
        <div className="stat-number text-[22px]">{guests.length}</div>
        <div className="-mt-1 text-[10px] uppercase tracking-wider text-ink-faint">on the mountain</div>
        <div className="pt-1.5">
          Mood <span className="stat-number" style={{ color: satColor(avgSat) }}>{Math.round(avgSat)}%</span>
        </div>
        <div className="text-ink-soft">⛷ {skiing} skiing</div>
        <div className="text-ink-soft">🚡 {riding} riding · {queueing} in line</div>
        <div className="text-ink-soft">Arrived today: {game.guestsArrivedToday}</div>
        <div className="text-ink-soft">Departed: {game.departedToday.length}</div>
      </div>
      <ul className="scroll-thin flex-1 space-y-0.5 overflow-y-auto">
        {guests.slice(0, 40).map((g) => (
          <li key={g.id}>
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2 py-0.5 text-left text-[12px] hover:bg-ink/5"
              onClick={() => select({ type: 'guest', id: g.id })}
            >
              <span className="h-2 w-2 flex-none rounded-full" style={{ background: satColor(g.satisfaction) }} />
              <span className="flex-1 truncate font-medium">{g.name}</span>
              <span className="flex-none text-[11px] text-ink-faint">{g.skill}</span>
              <span className="flex-none stat-number w-8 text-right text-[11px]">{Math.round(g.satisfaction)}</span>
            </button>
          </li>
        ))}
        {guests.length > 40 && <li className="px-2 text-[11px] italic text-ink-faint">…and {guests.length - 40} more</li>}
      </ul>
    </div>
  )
}

function FinanceTab() {
  const game = useStore((s) => s.game)!
  const reports = game.reports.slice(-14)
  const max = Math.max(1000, ...reports.map((r) => Math.abs(r.netProfit)))

  return (
    <div className="flex h-full gap-4 p-3">
      <div className="flex-1">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-ink-faint">Net profit, last {reports.length} days</div>
        {reports.length === 0 ? (
          <div className="text-[12px] italic text-ink-faint">Finish a day to see the books.</div>
        ) : (
          <svg viewBox={`0 0 ${reports.length * 34} 120`} className="h-[120px]" preserveAspectRatio="xMinYMid meet">
            <line x1="0" y1="60" x2={reports.length * 34} y2="60" stroke="rgba(22,35,43,0.15)" strokeWidth="1" />
            {reports.map((r, i) => {
              const h = (Math.abs(r.netProfit) / max) * 52
              const up = r.netProfit >= 0
              return (
                <g key={r.day}>
                  <rect
                    x={i * 34 + 5}
                    y={up ? 60 - h : 60}
                    width={22}
                    height={Math.max(1.5, h)}
                    rx={3}
                    fill={up ? '#2e7d4f' : '#c0392b'}
                    opacity={0.85}
                  />
                  <text x={i * 34 + 16} y={114} textAnchor="middle" fontSize="9" fill="#74868f">
                    {r.day}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
      </div>
      <div className="w-52 flex-none space-y-1 border-l border-ink/8 pl-4 text-[12px]">
        <div className="text-[10px] uppercase tracking-wider text-ink-faint">Season</div>
        <div>
          Guests <span className="stat-number">{game.totalGuestsSeason.toLocaleString()}</span>
        </div>
        <div>
          Debt{' '}
          <span className="stat-number">{formatMoney(game.loans.reduce((s, l) => s + l.balance, 0))}</span>
        </div>
        <div>
          Serious incidents <span className="stat-number">{game.seasonIncidents}</span>
        </div>
        <div>
          Staff morale <span className="stat-number">{Math.round(game.staffMorale * 100)}%</span>
        </div>
      </div>
    </div>
  )
}
