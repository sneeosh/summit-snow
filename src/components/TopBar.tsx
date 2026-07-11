/** Compact command bar: brand, date/clock, weather + forecast, cash, stars, speed. */
import { useState } from 'react'
import { SEASON_DAYS } from '../content/balance'
import { isWeekend } from '../game/economy'
import { forecastFor } from '../game/weather'
import { formatClock, formatMoney, useStore } from '../state/store'

export function TopBar() {
  const game = useStore((s) => s.game)
  const speed = useStore((s) => s.speed)
  const setSpeed = useStore((s) => s.setSpeed)
  const openResortNow = useStore((s) => s.openResortNow)
  const endDayNow = useStore((s) => s.endDayNow)
  const toMenu = useStore((s) => s.toMenu)
  const saveSlot = useStore((s) => s.saveSlot)
  const [showForecast, setShowForecast] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  if (!game) return null
  const weather = game.weatherSeason[game.day - 1]
  const operating = game.phase === 'operating'

  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-30 -translate-x-1/2">
      <div className="glass flex items-center gap-4 rounded-2xl px-4 py-2">
        {/* brand */}
        <div className="pr-3 border-r border-ink/10">
          <div className="font-display text-[15px] font-semibold leading-tight tracking-tight">Summit &amp; Snow</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-faint">Mount Alder</div>
        </div>

        {/* date + clock */}
        <div className="text-center">
          <div className="stat-number text-[15px] leading-tight">
            Day {game.day}
            <span className="text-ink-faint text-[11px]"> / {SEASON_DAYS}</span>
          </div>
          <div className="text-[11px] text-ink-soft leading-tight">
            {isWeekend(game.day) ? 'Weekend' : 'Weekday'} · {operating ? formatClock(game.minute) : game.phase === 'planning' ? 'Dawn' : 'Dusk'}
          </div>
        </div>

        {/* weather + forecast */}
        <button
          className="rounded-lg px-2 py-1 text-left hover:bg-ink/5 transition-colors"
          onClick={() => setShowForecast((v) => !v)}
          title="7-day forecast"
        >
          <div className="text-[13px] font-semibold leading-tight">
            {weatherIcon(weather.summary)} {weather.summary}
          </div>
          <div className="text-[11px] text-ink-soft leading-tight">
            {weather.tempLow}° / {weather.tempHigh}°C · wind {weather.windKph}
            {weather.snowfallCm > 0 ? ` · ❄ ${weather.snowfallCm} cm` : ''}
          </div>
        </button>

        {/* cash */}
        <div className="text-center px-1">
          <div className={`stat-number text-[16px] leading-tight ${game.cash < 0 ? 'text-safety' : ''}`}>
            {formatMoney(game.cash)}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-ink-faint leading-tight">cash</div>
        </div>

        {/* reputation */}
        <div className="text-center px-1" title={`Reputation ${game.reputation.toFixed(2)} / 5`}>
          <Stars value={game.reputation} />
          <div className="text-[10px] uppercase tracking-wider text-ink-faint leading-tight">reputation</div>
        </div>

        {/* guests today */}
        <div className="text-center px-1">
          <div className="stat-number text-[15px] leading-tight">{Object.keys(game.guests).length}</div>
          <div className="text-[10px] uppercase tracking-wider text-ink-faint leading-tight">on the hill</div>
        </div>

        {/* time controls */}
        <div className="flex items-center gap-1 border-l border-ink/10 pl-3">
          {game.phase === 'planning' && (
            <button className="btn btn-wood" onClick={openResortNow}>
              ⛷ Open the resort
            </button>
          )}
          {operating && (
            <>
              <SpeedButton label="⏸" active={speed === 0} onClick={() => setSpeed(0)} title="Pause (space)" />
              <SpeedButton label="▶" active={speed === 1} onClick={() => setSpeed(1)} title="Normal speed (1)" />
              <SpeedButton label="▶▶" active={speed === 4} onClick={() => setSpeed(4)} title="Fast (2)" />
              <button className="btn btn-ghost !px-2.5" onClick={endDayNow} title="Skip to close of day">
                End day
              </button>
            </>
          )}
          {game.phase === 'day-end' && (
            <span className="text-[12px] text-ink-soft italic px-2">Reviewing the day…</span>
          )}
        </div>

        {/* system menu */}
        <div className="relative">
          <button className="btn btn-ghost !px-2.5" onClick={() => setMenuOpen((v) => !v)} title="Menu">
            ☰
          </button>
          {menuOpen && (
            <div className="glass absolute right-0 top-11 z-40 w-44 rounded-xl p-1.5 rise-in">
              <button
                className="w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium hover:bg-ink/5"
                onClick={() => {
                  const ok = saveSlot('manual', `Day ${game.day} — manual save`)
                  setSavedFlash(ok)
                  setTimeout(() => setSavedFlash(false), 1500)
                }}
              >
                {savedFlash ? '✓ Saved' : 'Save game'}
              </button>
              <button
                className="w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium hover:bg-ink/5"
                onClick={() => {
                  setMenuOpen(false)
                  toMenu()
                }}
              >
                Exit to menu
              </button>
            </div>
          )}
        </div>
      </div>

      {showForecast && (
        <div className="glass mt-2 rounded-xl px-3 py-2.5 rise-in">
          <div className="flex gap-1.5">
            {Array.from({ length: 7 }, (_, i) => {
              const day = game.day + i
              if (day > SEASON_DAYS) return null
              const f = forecastFor(game.weatherSeason, game.seed, game.day, day)
              return (
                <div key={day} className={`rounded-lg px-2.5 py-1.5 text-center ${i === 0 ? 'bg-ink/8' : ''}`}>
                  <div className="text-[10px] font-semibold text-ink-faint">{i === 0 ? 'Today' : `Day ${day}`}</div>
                  <div className="text-[16px] leading-tight">{weatherIcon(f.summary)}</div>
                  <div className="text-[11px] font-medium">{f.tempHigh}°</div>
                  <div className="text-[10px] text-diff-blue font-semibold">{f.snowfallCm > 0 ? `${f.snowfallCm}cm` : '—'}</div>
                </div>
              )
            })}
          </div>
          <div className="mt-1 text-[10px] text-ink-faint italic">Forecast confidence fades beyond a few days.</div>
        </div>
      )}
    </div>
  )
}

function SpeedButton({ label, active, onClick, title }: { label: string; active: boolean; onClick: () => void; title: string }) {
  return (
    <button
      className={`btn !px-2.5 ${active ? 'btn-primary' : 'btn-ghost'}`}
      onClick={onClick}
      title={title}
    >
      {label}
    </button>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex justify-center gap-[1px] text-[12px] leading-tight" aria-label={`${value.toFixed(1)} stars`}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.max(0, Math.min(1, value - i))
        return (
          <span key={i} className="relative inline-block w-[13px] text-snow-3">
            ★
            <span className="absolute inset-0 overflow-hidden text-amber" style={{ width: `${fill * 100}%` }}>
              ★
            </span>
          </span>
        )
      })}
    </div>
  )
}

export function weatherIcon(summary: string): string {
  if (summary.includes('Heavy')) return '🌨'
  if (summary.includes('snow') || summary.includes('Snow') || summary.includes('Flurries')) return '❄️'
  if (summary.includes('wind') || summary.includes('Wind')) return '💨'
  if (summary.includes('Bluebird') || summary.includes('sunny')) return '☀️'
  if (summary.includes('Partly')) return '⛅'
  if (summary.includes('Uncertain')) return '🌫'
  return '☁️'
}
