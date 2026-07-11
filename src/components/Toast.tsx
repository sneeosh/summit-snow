/** Transient error toast for rejected actions (not enough cash, etc). */
import { useEffect } from 'react'
import { useStore } from '../state/store'

export function Toast() {
  const error = useStore((s) => s.actionError)
  const clearError = useStore((s) => s.clearError)

  useEffect(() => {
    if (!error) return
    const t = setTimeout(clearError, 3200)
    return () => clearTimeout(t)
  }, [error, clearError])

  if (!error) return null
  return (
    <div className="pointer-events-none absolute bottom-24 left-1/2 z-50 -translate-x-1/2 rise-in">
      <div className="rounded-xl bg-ink px-4 py-2 text-[13px] font-medium text-white shadow-lg">{error}</div>
    </div>
  )
}
