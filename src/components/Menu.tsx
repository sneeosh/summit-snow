/** Main menu: new season, sandbox mountain pick, continue, saved games. */
import { useState } from 'react'
import { GAME_VERSION, RELEASES } from '../content/releases'
import { STARTING_CASH_SANDBOX } from '../content/balance'
import { MOUNTAINS, snowfallLabel } from '../content/mountains'
import { listSaves, deleteSave } from '../state/save'
import { useStore } from '../state/store'
import type { MountainDef } from '../game/types'

export function MainMenu() {
  const startNew = useStore((s) => s.startNew)
  const loadSlot = useStore((s) => s.loadSlot)
  const [showLoad, setShowLoad] = useState(false)
  const [showHow, setShowHow] = useState(false)
  const [showPick, setShowPick] = useState(false)
  const saves = listSaves()
  const latestSave = saves[0]

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden">
      {/* backdrop */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#aecbe0] via-[#dbe7ef] to-[#f2f5f7]" />
      <MountainBackdrop />

      <div className="relative z-10 max-h-full w-[420px] max-w-full overflow-y-auto px-6 py-6 scroll-thin">
        <div className="mb-1 text-center text-[11px] font-bold uppercase tracking-[0.3em] text-ink-soft">
          Eight mountains · One company
        </div>
        <h1 className="font-display text-center text-[56px] font-semibold leading-none tracking-tight text-ink">
          Summit <span className="text-wood">&amp;</span> Snow
        </h1>
        <p className="mt-2 text-center text-[13px] text-ink-soft">
          One creaky carpet lift, two green runs, and a mountain of potential.
        </p>

        <p className="mt-3 text-center text-[11px] font-semibold tracking-wide text-ink-soft">
          Version {GAME_VERSION} · Release candidate
        </p>

        <div className="mt-6 space-y-2">
          {latestSave && (
            <button className="btn btn-primary w-full !py-3 text-[14px]" onClick={() => loadSlot(latestSave.slot)}>
              Continue season
            </button>
          )}
          <button
            className={`btn w-full !py-3 text-[14px] ${latestSave ? 'btn-ghost' : 'btn-primary'}`}
            onClick={() => startNew('scenario')}
          >
            New season — Scenario
          </button>
          <button
            className="btn btn-ghost w-full !py-3 text-[14px]"
            onClick={() => setShowPick((v) => !v)}
          >
            Sandbox — pick your mountain {showPick ? '▾' : '▸'}
          </button>
          {showPick && (
            <div className="glass max-h-[46vh] space-y-1.5 overflow-y-auto scroll-thin rounded-xl p-2 rise-in">
              <div className="px-1 text-[10.5px] text-ink-soft">
                You start with ${STARTING_CASH_SANDBOX.toLocaleString()} — the purchase price comes out of it. Earn your
                way to the famous ones.
              </div>
              {MOUNTAINS.map((m) => {
                const affordable = m.price <= STARTING_CASH_SANDBOX
                return (
                  <button
                    key={m.id}
                    disabled={!affordable}
                    onClick={() => startNew('sandbox', undefined, m.id)}
                    className={`block w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
                      affordable ? 'border-ink/10 hover:border-pine hover:bg-pine/5' : 'border-ink/5 opacity-55'
                    }`}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-[13px] font-bold">{m.name}</span>
                      <span className="stat-number text-[12px] text-wood">${m.price.toLocaleString()}</span>
                    </div>
                    <div className="text-[10px] text-ink-faint">{m.region}</div>
                    <SkylineMini mountain={m} />
                    <div className="mt-0.5 flex flex-wrap gap-x-2.5 text-[10px] text-ink-soft">
                      <span>↕ {(m.topElev - m.baseElev).toLocaleString()} m</span>
                      <span>❄ {snowfallLabel(m.climate.snowfallMult)}</span>
                      <span>👥 ~{m.baseDemand}/day</span>
                      {!affordable && <span className="font-semibold text-safety">out of reach — for now</span>}
                    </div>
                    <div className="mt-0.5 text-[10.5px] leading-snug text-ink-soft">{m.blurb}</div>
                    {m.identity && <div className="mt-2 border-t border-ink/10 pt-2 text-[12px] leading-relaxed" style={{ color: m.identity.accent }}>{m.identity.strategy}</div>}
                  </button>
                )
              })}
            </div>
          )}
          {saves.length > 0 && (
            <button className="btn btn-ghost w-full" onClick={() => setShowLoad((v) => !v)}>
              Load game {showLoad ? '▾' : '▸'}
            </button>
          )}
          {showLoad && (
            <div className="glass max-h-44 space-y-1 overflow-y-auto scroll-thin rounded-xl p-2 rise-in">
              {saves.map((s) => (
                <div key={s.slot} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ink/5">
                  <button className="flex-1 text-left" onClick={() => loadSlot(s.slot)}>
                    <div className="text-[12px] font-semibold">{s.label}</div>
                    <div className="text-[10px] text-ink-faint">
                      {s.mode} · day {s.day} · ${s.cash.toLocaleString()} · {new Date(s.savedAt).toLocaleString()}
                    </div>
                  </button>
                  <button
                    className="text-[11px] text-ink-faint hover:text-safety"
                    title="Delete save"
                    onClick={() => {
                      deleteSave(s.slot)
                      setShowLoad(false)
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-ghost w-full" onClick={() => setShowHow((v) => !v)}>
            How to play {showHow ? '▾' : '▸'}
          </button>
          {showHow && (
            <div className="glass rounded-xl p-3.5 text-[12px] leading-relaxed text-ink-soft rise-in">
              <p>
                <strong>Mornings</strong> are for building: lifts up the hill, trails down it, food and warmth in the
                village. Then <strong>open the resort</strong> and watch guests arrive.
              </p>
              <p className="mt-1.5">
                Guests pick terrain that matches their ability, queue for lifts, get hungry and cold, and spend money —
                if you give them somewhere to spend it. Their satisfaction becomes your <strong>reputation</strong>,
                and reputation drives tomorrow’s crowd.
              </p>
              <p className="mt-1.5">
                Watch the <strong>forecast</strong>: powder days pack the lot, warm spells rot your snowpack (guns and
                groomers help), and wind closes exposed lifts. Don’t go broke.
              </p>
            </div>
          )}
        </div>
        <section aria-label="Release notes" className="mt-5 border-t border-ink/15 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">Latest update · {RELEASES[0].dateLabel}</p>
          <h2 className="mt-1 font-display text-[21px] font-semibold text-ink">{RELEASES[0].title}</h2>
          <p className="mt-1 mb-3 text-[12px] leading-relaxed text-ink-soft">{RELEASES[0].summary}</p>
          <details className="glass rounded-xl p-3.5 text-[12px] leading-relaxed text-ink-soft">
            <summary className="cursor-pointer rounded font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pine">
              Read release notes & update history
            </summary>
            {RELEASES.map(release => (
              <article key={release.version} className="mt-3">
                <h2 className="font-display text-[18px] font-semibold text-ink">{release.title}</h2>
                <p className="mt-1 text-[10px] text-ink-soft">Version {release.version} · <time dateTime={release.date}>{release.dateLabel}</time></p>
                <p className="mt-2">{release.summary}</p>
                <ul className="mt-3 list-disc space-y-2 pl-4">
                  {release.changes.map(change => <li key={change}>{change}</li>)}
                </ul>
              </article>
            ))}
          </details>
        </section>
      </div>
    </div>
  )
}

/** tiny true-to-scale silhouette so the cards read as different mountains */
function SkylineMini({ mountain }: { mountain: MountainDef }) {
  const pts = ['0,1100', ...mountain.skyline.map(([x, y]) => `${x},${y}`), '1920,1100']
  return (
    <svg className="mt-1 h-12 w-full rounded" viewBox="0 80 1920 1020" preserveAspectRatio="none" aria-hidden>
      <polygon points={pts.join(' ')} fill={mountain.identity?.accent ?? '#b7c9d6'} opacity="0.22" />
      <polyline points={mountain.skyline.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={mountain.identity?.accent ?? '#8fa5b5'} strokeWidth="14" />
    </svg>
  )
}

function MountainBackdrop() {
  return (
    <svg className="absolute inset-x-0 bottom-0 h-[55%] w-full" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMax slice">
      <polygon points="0,400 0,270 220,180 420,240 560,140 760,60 900,120 1050,90 1200,190 1200,400" fill="#c3d3de" />
      <polygon points="0,400 0,330 180,260 400,310 620,200 820,140 1000,220 1200,270 1200,400" fill="#e2eaef" />
      <polygon points="560,140 760,60 900,120 830,150 760,110 640,170" fill="#f6fafc" />
      <g fill="#2f4a3e" opacity="0.85">
        {Array.from({ length: 26 }, (_, i) => {
          const x = 40 + i * 45 + (i % 3) * 12
          const y = 330 + (i % 5) * 12
          const s = 9 + (i % 4) * 3
          return <polygon key={i} points={`${x},${y - s * 2} ${x + s},${y} ${x - s},${y}`} />
        })}
      </g>
    </svg>
  )
}
