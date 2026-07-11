/** Scenario objectives widget with progress. */
import { useState } from 'react'
import { useStore } from '../state/store'
import { Meter } from './shared'

export function Objectives() {
  const game = useStore((s) => s.game)
  const [open, setOpen] = useState(true)
  if (!game || game.mode !== 'scenario' || game.objectives.length === 0) return null
  const done = game.objectives.filter((o) => o.achieved).length

  return (
    <div className="pointer-events-auto absolute right-3 bottom-20 z-20 w-[min(260px,calc(100vw-24px))]">
      <div className="glass rounded-2xl p-3">
        <button className="flex w-full items-center justify-between" onClick={() => setOpen((v) => !v)}>
          <span className="panel-title text-[14px]">
            {game.scenarioComplete ? '🏆 Objectives complete' : 'Objectives'}
          </span>
          <span className="text-[11px] font-semibold text-ink-faint">
            {done}/{game.objectives.length} {open ? '▾' : '▸'}
          </span>
        </button>
        {open && (
          <ul className="scroll-thin mt-2 max-h-[min(46vh,420px)] space-y-2 overflow-y-auto">
            {game.objectives.map((o) => (
              <li key={o.id} className="text-[11px]">
                <div className="flex items-start gap-1.5">
                  <span className={`mt-[1px] flex-none ${o.achieved ? 'text-diff-green' : 'text-snow-3'}`}>
                    {o.achieved ? '✔' : '○'}
                  </span>
                  <div className="flex-1">
                    <div className={`font-medium leading-snug ${o.achieved ? 'text-ink-faint line-through' : ''}`}>{o.label}</div>
                    {!o.achieved && (
                      <>
                        <div className="mt-1">
                          <Meter value={o.progress * 100} />
                        </div>
                        <div className="mt-0.5 text-[10px] text-ink-faint">{o.detail}</div>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
