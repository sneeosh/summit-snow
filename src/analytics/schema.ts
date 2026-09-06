export const EVENTS = ['page_view', 'new_game', 'continue_game', 'resort_opened', 'day_completed', 'active_time'] as const
export type EventName = typeof EVENTS[number]
export interface AnalyticsEvent {
  id: string; player: string; visit: string; event: EventName
  source: string; medium: string; campaign: string; content: string
  mode: string; mountain: string; day: number; seconds: number
  version: string; test: boolean
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function tag(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 64) : ''
}
export function validateEvent(value: unknown): AnalyticsEvent | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (![v.id, v.player, v.visit].every(x => typeof x === 'string' && uuid.test(x))) return null
  if (!EVENTS.includes(v.event as EventName)) return null
  if (!Number.isInteger(v.day) || Number(v.day) < 0 || Number(v.day) > 100000) return null
  if (!Number.isInteger(v.seconds) || Number(v.seconds) < 0 || Number(v.seconds) > 60) return null
  if (v.event !== 'active_time' && v.seconds !== 0) return null
  return {
    id: v.id as string, player: v.player as string, visit: v.visit as string,
    event: v.event as EventName, source: tag(v.source) || 'direct', medium: tag(v.medium),
    campaign: tag(v.campaign), content: tag(v.content), mode: tag(v.mode), mountain: tag(v.mountain),
    day: Number(v.day), seconds: Number(v.seconds), version: tag(v.version), test: v.test === true,
  }
}
export function attribution(href: string, referrer: string) {
  const url = new URL(href)
  let source = tag(url.searchParams.get('utm_source'))
  if (!source && referrer) {
    try {
      const host = new URL(referrer).hostname.toLowerCase()
      if (host !== url.hostname) source = /(^|\.)(x.com|twitter.com|t.co)$/.test(host) ? 'x'
        : /(^|\.)linkedin.com$/.test(host) ? 'linkedin' : tag(host)
    } catch { /* invalid referrer */ }
  }
  return { source: source || 'direct', medium: tag(url.searchParams.get('utm_medium')),
    campaign: tag(url.searchParams.get('utm_campaign')), content: tag(url.searchParams.get('utm_content')) }
}
// Time only accrues while visible, focused, in-game, and recently interacted with.
export function activeDelta(now: number, last: number, lastInput: number, eligible: boolean): number {
  if (!eligible || now - lastInput > 60000 || now < last) return 0
  return Math.min(now - last, 5000) / 1000
}
