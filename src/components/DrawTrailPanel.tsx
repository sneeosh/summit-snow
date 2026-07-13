/**
 * Floating cost/verdict panel while drawing a custom trail. Warns about
 * uphill stretches, unreachable tops, and dead ends — but never blocks
 * the build. Full control means full responsibility.
 */
import { getTrailDef, getNode, planCustomTrail } from '../game/trails'
import { formatMoney, useStore } from '../state/store'
import { DiffBadge } from './shared'

export function DrawTrailPanel() {
  const game = useStore((s) => s.game)
  const buildMode = useStore((s) => s.buildMode)
  const undoDrawPoint = useStore((s) => s.undoDrawPoint)
  const confirmDrawTrail = useStore((s) => s.confirmDrawTrail)
  const setBuildMode = useStore((s) => s.setBuildMode)
  if (!game || buildMode?.type !== 'draw-trail') return null

  const points = buildMode.points
  const plan = points.length >= 2 ? planCustomTrail(game, points) : null
  const a = plan?.analysis

  return (
    <div className="pointer-events-auto absolute left-1/2 top-[74px] z-30 w-[min(390px,calc(100vw-24px))] -translate-x-1/2">
      <div className="glass rounded-2xl border-l-4 !border-l-pine p-3.5 rise-in">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-pine">Drawing a trail</span>
          <span className="text-[11px] text-ink-faint">{points.length} point{points.length === 1 ? '' : 's'}</span>
        </div>

        {points.length === 0 && (
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">
            Click the mountain to drop waypoints, top to bottom. Start and end at the ringed stations so skiers can
            actually use it.
          </p>
        )}
        {points.length === 1 && (
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">
            Keep clicking downhill — the ghost follows your cursor. Double-click or press Enter to finish.
          </p>
        )}

        {plan && a && (
          <>
            <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
              <Stat label="length" value={`${a.lengthM.toLocaleString()} m`} />
              <Stat label="vertical" value={`${a.verticalM} m`} />
              <div className="rounded-lg bg-ink/4 px-1 py-1.5">
                <div className="flex items-center justify-center gap-1 text-[13px]">
                  <DiffBadge difficulty={a.difficulty} />
                </div>
                <div className="mt-0.5 text-[9px] uppercase tracking-wider text-ink-faint">grade</div>
              </div>
              <Stat label="trees" value={String(plan.treesToClear)} />
            </div>

            <div className="mt-2 flex items-baseline justify-between text-[12px]">
              <span className="text-ink-soft">
                Groundwork {formatMoney(plan.groundworkCost)} · Clearing {formatMoney(plan.clearingCost)}
              </span>
              <span className="stat-number text-[16px] text-wood">{formatMoney(plan.totalCost)}</span>
            </div>

            {plan.conflicts.blockers.length > 0 && (
              <ul className="mt-2 space-y-1">
                {plan.conflicts.blockers.map((b) => (
                  <li key={b} className="flex gap-1.5 text-[11px] font-bold leading-snug text-[#c0392b]">
                    <span className="flex-none">✕</span> {b}
                  </li>
                ))}
              </ul>
            )}
            {plan.warnings.length > 0 && (
              <ul className="mt-2 space-y-1">
                {plan.warnings.map((w) => (
                  <li key={w} className="flex gap-1.5 text-[11px] font-medium leading-snug text-safety">
                    <span className="flex-none">⚠</span> {w}
                  </li>
                ))}
              </ul>
            )}
            {(plan.conflicts.topMerge || plan.conflicts.bottomMerge || plan.conflicts.crossings.length > 0) && (
              <div className="mt-2 space-y-0.5 text-[11px] font-medium text-diff-green">
                {plan.conflicts.topMerge && <div>↰ forks off {getTrailDef(game, plan.conflicts.topMerge.trailId).name}</div>}
                {plan.conflicts.bottomMerge && <div>↳ merges into {getTrailDef(game, plan.conflicts.bottomMerge.trailId).name}</div>}
                {plan.conflicts.crossings.length > 0 && (
                  <div>
                    ✕ crosses {plan.conflicts.crossings.length} line{plan.conflicts.crossings.length > 1 ? 's' : ''} — skiers pick their way at each junction
                  </div>
                )}
              </div>
            )}
            {plan.warnings.length === 0 && plan.conflicts.blockers.length === 0 && a.topNodeId && (
              <div className="mt-2 text-[11px] font-medium text-diff-green">
                ✓ Clean line from {getNode(game, a.topNodeId)?.name ?? 'the station'}
                {a.bottomNodeId ? ` down to ${getNode(game, a.bottomNodeId)?.name ?? 'the station'}` : ''}
              </div>
            )}
          </>
        )}

        <div className="mt-3 flex gap-1.5">
          <button
            className="btn btn-primary flex-1"
            disabled={!plan || plan.conflicts.blockers.length > 0}
            onClick={confirmDrawTrail}
            title="Finish the line (enter or double-click)"
          >
            Cut this trail{plan ? ` — ${formatMoney(plan.totalCost)}` : ''}
          </button>
          <button className="btn btn-ghost" disabled={points.length === 0} onClick={undoDrawPoint} title="Remove last point (backspace)">
            Undo
          </button>
          <button className="btn btn-ghost" onClick={() => setBuildMode(null)} title="Cancel (esc)">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ink/4 px-1 py-1.5">
      <div className="stat-number text-[13px]">{value}</div>
      <div className="mt-0.5 text-[9px] uppercase tracking-wider text-ink-faint">{label}</div>
    </div>
  )
}
