/** Narrative event cards — appear over the village until answered. */
import { useStore } from '../state/store'

const CATEGORY_LABEL: Record<string, string> = {
  guest: 'Guests',
  staff: 'Staff',
  weather: 'Weather',
  financial: 'Business',
  safety: 'Safety',
  community: 'Community',
}

export function EventsUI() {
  const game = useStore((s) => s.game)
  const resolve = useStore((s) => s.resolveEventChoice)
  if (!game) return null
  const pending = game.events.filter((e) => !e.resolved)
  if (pending.length === 0) return null
  const event = pending[0]

  return (
    <div className="pointer-events-auto absolute left-1/2 top-[var(--hud-content-top,80px)] z-30 w-[min(420px,calc(100vw-24px))] -translate-x-1/2">
      <div style={{ background: '#f2f5f7' }} className="glass scroll-thin max-h-[calc(100dvh-var(--hud-content-top,80px)-24px)] overflow-y-auto rounded-2xl border-l-4 !border-l-wood p-4 rise-in">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-wood">
          {CATEGORY_LABEL[event.category]} · Day {event.day}
        </div>
        <h3 className="font-display mt-1 text-[18px] font-semibold leading-snug">{event.title}</h3>
        <p className="mt-1 text-[13px] font-medium text-ink-soft">{event.summary}</p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-faint">{event.body}</p>
        <div className="mt-3 space-y-1.5">
          {event.choices.map((c) => (
            <button
              key={c.id}
              onClick={() => resolve(event.id, c.id)}
              className="w-full rounded-xl border border-ink/12 px-3 py-2 text-left transition-colors hover:border-wood hover:bg-wood/8"
            >
              <div className="text-[13px] font-semibold">{c.label}</div>
              <div className="text-[11px] text-ink-faint">{c.description}</div>
            </button>
          ))}
        </div>
        {pending.length > 1 && (
          <div className="mt-2 text-center text-[10px] text-ink-faint">+{pending.length - 1} more waiting</div>
        )}
      </div>
    </div>
  )
}
