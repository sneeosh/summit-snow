/** Small shared UI atoms. */
import type { Difficulty } from '../game/types'

/** authentic trail-marker shapes: ● ■ ◆ ◆◆ */
export function DiffBadge({ difficulty }: { difficulty: Difficulty }) {
  const cls = 'diff-badge'
  switch (difficulty) {
    case 'green':
      return <svg className={cls} viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="#2e7d4f" /></svg>
    case 'blue':
      return <svg className={cls} viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" fill="#2f6fb2" /></svg>
    case 'black':
      return <svg className={cls} viewBox="0 0 12 12"><path d="M6 0.5 L11.5 6 L6 11.5 L0.5 6 Z" fill="#22262a" /></svg>
    case 'double-black':
      return (
        <svg className={cls} viewBox="0 0 20 12" style={{ width: 20 }}>
          <path d="M5.5 0.5 L11 6 L5.5 11.5 L0 6 Z" fill="#22262a" />
          <path d="M14.5 0.5 L20 6 L14.5 11.5 L9 6 Z" fill="#22262a" />
        </svg>
      )
  }
}

export function Meter({ value, color = 'var(--color-pine)' }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </div>
  )
}

export function satColor(v: number): string {
  if (v >= 70) return '#2e7d4f'
  if (v >= 45) return '#d9913d'
  return '#c0392b'
}
