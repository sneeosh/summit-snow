/** End-of-day operating report modal. */
import { SKILL_LABEL } from '../content/names'
import { dayEndDisposition } from '../game/simulation'
import { formatMoney, useStore } from '../state/store'

export function DailyReportModal() {
  const game = useStore((s) => s.game)
  const show = useStore((s) => s.showReport)
  const dismissReport = useStore((s) => s.dismissReport)
  const advanceToNextDay = useStore((s) => s.advanceToNextDay)
  if (!game || !show) return null
  const report = game.reports[game.reports.length - 1]
  if (!report) return null

  const rev = report.revenue
  const revTotal = rev.tickets + rev.rentals + rev.food + rev.lessons + rev.parking
  const exp = report.expenses
  const expTotal = exp.payroll + exp.maintenance + exp.energy + exp.facilities + exp.interest + exp.other
  // sandbox seasons roll over — only a true game-over ends the road
  const disposition = dayEndDisposition(game)
  const seasonOver = disposition === 'game-over'
  const seasonRolls = disposition === 'season-rolls'

  return (
    <div className="fade-in pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-ink/30 p-6 backdrop-blur-[2px]">
      <div className="glass max-h-full w-[min(680px,100%)] overflow-y-auto scroll-thin rounded-3xl p-6 rise-in">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-faint">Operating report</div>
        <h2 className="font-display text-[26px] font-semibold leading-tight">
          Day {report.day} — {report.netProfit >= 0 ? 'in the black' : 'in the red'}
        </h2>

        <div className="mt-4 grid grid-cols-4 gap-2">
          <Stat label="Guests" value={String(report.guestsServed)} />
          <Stat label="Satisfaction" value={`${report.avgSatisfaction}%`} tone={report.avgSatisfaction >= 65 ? 'good' : report.avgSatisfaction >= 45 ? 'mid' : 'bad'} />
          <Stat label="Net" value={formatMoney(report.netProfit)} tone={report.netProfit >= 0 ? 'good' : 'bad'} />
          <Stat label="Incidents" value={String(report.incidents)} tone={report.incidents === 0 ? 'good' : 'bad'} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Revenue — {formatMoney(revTotal)}</h4>
            <MoneyRow label="Lift tickets" v={rev.tickets} />
            <MoneyRow label="Food & beverage" v={rev.food} />
            <MoneyRow label="Rentals" v={rev.rentals} />
            <MoneyRow label="Ski school" v={rev.lessons} />
            <MoneyRow label="Parking" v={rev.parking} />
          </div>
          <div>
            <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Expenses — {formatMoney(expTotal)}</h4>
            <MoneyRow label="Payroll" v={exp.payroll} neg />
            <MoneyRow label="Lift maintenance" v={exp.maintenance} neg />
            <MoneyRow label="Energy" v={exp.energy} neg />
            <MoneyRow label="Facilities" v={exp.facilities} neg />
            <MoneyRow label="Loan interest" v={exp.interest} neg />
          </div>
        </div>

        {(report.compliments.length > 0 || report.complaints.length > 0) && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-diff-green">Guests loved</h4>
              {report.compliments.length === 0 && <div className="text-[12px] italic text-ink-faint">Not much, honestly.</div>}
              {report.compliments.map((c) => (
                <div key={c.text} className="text-[12px] text-ink-soft">
                  {c.text} <span className="text-ink-faint">×{c.count}</span>
                </div>
              ))}
            </div>
            <div>
              <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-safety">Guests griped about</h4>
              {report.complaints.length === 0 && <div className="text-[12px] italic text-ink-faint">No complaints. Frame this report.</div>}
              {report.complaints.map((c) => (
                <div key={c.text} className="text-[12px] text-ink-soft">
                  {c.text} <span className="text-ink-faint">×{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.reviews.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint">From the guest book</h4>
            <div className="grid grid-cols-2 gap-2">
              {report.reviews.map((r, i) => (
                <div key={i} className="rounded-xl bg-ink/4 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold">{r.name}</span>
                    <span className="text-[11px] text-amber">{'★'.repeat(r.stars)}<span className="text-snow-3">{'★'.repeat(5 - r.stars)}</span></span>
                  </div>
                  <div className="text-[10px] text-ink-faint">{SKILL_LABEL[r.skill]}</div>
                  <p className="mt-1 text-[12px] italic leading-snug text-ink-soft">“{r.text}”</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.highlights.length > 0 && (
          <ul className="mt-3 space-y-0.5">
            {report.highlights.map((h) => (
              <li key={h} className="text-[12px] text-ink-soft">• {h}</li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex justify-end gap-2">
          {seasonOver ? (
            <SeasonEndActions />
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => {
                dismissReport()
                advanceToNextDay()
              }}
            >
              {seasonRolls ? `Open Season ${game.season + 1} →` : `On to Day ${game.day + 1} →`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function SeasonEndActions() {
  const game = useStore((s) => s.game)!
  const toMenu = useStore((s) => s.toMenu)
  const bankrupt = game.cash < -10000
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="text-[13px] font-medium text-ink-soft">
        {bankrupt
          ? 'The bank has foreclosed on the resort.'
          : game.scenarioComplete
            ? '🏆 Every objective met — the mountain is the valley’s success story.'
            : 'The season is over. The mountain sleeps.'}
      </div>
      <button className="btn btn-primary" onClick={toMenu}>
        Back to menu
      </button>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'mid' | 'bad' }) {
  const color = tone === 'good' ? 'text-diff-green' : tone === 'bad' ? 'text-safety' : tone === 'mid' ? 'text-amber' : ''
  return (
    <div className="rounded-xl bg-ink/4 p-2.5 text-center">
      <div className={`stat-number text-[20px] ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-ink-faint">{label}</div>
    </div>
  )
}

function MoneyRow({ label, v, neg }: { label: string; v: number; neg?: boolean }) {
  return (
    <div className="flex justify-between text-[12px]">
      <span className="text-ink-soft">{label}</span>
      <span className="stat-number">{neg ? '−' : ''}{formatMoney(Math.abs(v)).replace('−', '')}</span>
    </div>
  )
}
