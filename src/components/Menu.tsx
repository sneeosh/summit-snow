/** Main menu: new season, sandbox, continue, saved games. */
import { useState } from 'react'
import { listSaves, AUTOSAVE_SLOT, deleteSave } from '../state/save'
import { useStore } from '../state/store'

export function MainMenu() {
  const startNew = useStore((s) => s.startNew)
  const loadSlot = useStore((s) => s.loadSlot)
  const [showLoad, setShowLoad] = useState(false)
  const [showHow, setShowHow] = useState(false)
  const saves = listSaves()
  const hasAutosave = saves.some((s) => s.slot === AUTOSAVE_SLOT)

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden">
      {/* backdrop */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#aecbe0] via-[#dbe7ef] to-[#f2f5f7]" />
      <MountainBackdrop />

      <div className="relative z-10 w-[420px] px-6">
        <div className="mb-1 text-center text-[11px] font-bold uppercase tracking-[0.3em] text-ink-soft">
          Mount Alder · Elevation 2,350 m
        </div>
        <h1 className="font-display text-center text-[56px] font-semibold leading-none tracking-tight text-ink">
          Summit <span className="text-wood">&amp;</span> Snow
        </h1>
        <p className="mt-2 text-center text-[13px] text-ink-soft">
          One creaky carpet lift, two green runs, and a mountain of potential.
        </p>

        <div className="mt-8 space-y-2">
          {hasAutosave && (
            <button className="btn btn-primary w-full !py-3 text-[14px]" onClick={() => loadSlot(AUTOSAVE_SLOT)}>
              Continue season
            </button>
          )}
          <button
            className={`btn w-full !py-3 text-[14px] ${hasAutosave ? 'btn-ghost' : 'btn-primary'}`}
            onClick={() => startNew('scenario')}
          >
            New season — Scenario
          </button>
          <button className="btn btn-ghost w-full !py-3 text-[14px]" onClick={() => startNew('sandbox')}>
            Sandbox — deep pockets, no pressure
          </button>
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
      </div>
    </div>
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
