import { GAME_VERSION } from '../content/releases'
import { activeDelta, attribution, type AnalyticsEvent, type EventName } from './schema'
const PLAYER_KEY = 'summit.analytics.player.v1'
const OPT_OUT = 'summit.analytics.off'
let send: ((event: EventName, game?: GameInfo, seconds?: number) => void) | undefined
interface GameInfo { mode: string; mountainId: string; day: number }
export function trackingDisabled(): boolean {
  try { return navigator.doNotTrack === '1' || ('globalPrivacyControl' in navigator && navigator.globalPrivacyControl === true) || localStorage.getItem(OPT_OUT) === '1' } catch { return true }
}
export function disableTracking(): void {
  try { localStorage.setItem(OPT_OUT, '1'); localStorage.removeItem(PLAYER_KEY) } catch { /* storage unavailable */ }
  send = undefined
}
export function track(event: EventName, game?: GameInfo): void {
  try { send?.(event, game) } catch { /* Analytics must never interrupt gameplay. */ }
}
export function startAnalytics(getGame: () => GameInfo | null): void {
  if (send || trackingDisabled()) return
  const query = new URLSearchParams(location.search)
  const test = query.get('analytics_test') === '1'
  if (location.hostname !== 'ski.kennyatx.com' && !test) return
  try {
    let player: { id: string; expires: number } | null = null
    try { player = JSON.parse(localStorage.getItem(PLAYER_KEY) || 'null') } catch { /* replace corrupt ID */ }
    if (!player || typeof player.id !== 'string' || !(player.expires > Date.now())) {
      player = { id: crypto.randomUUID(), expires: Date.now() + 90 * 86400000 }
      localStorage.setItem(PLAYER_KEY, JSON.stringify(player))
    }
    const playerId = player.id
    // A visit is one page load; returns are measured across separate UTC dates, not reloads.
    const visit = crypto.randomUUID()
    const source = attribution(location.href, document.referrer)
    send = (event, game, seconds = 0) => {
      if (trackingDisabled()) return
      const payload: AnalyticsEvent = { id: crypto.randomUUID(), player: playerId, visit, event,
        ...source, mode: game?.mode || '', mountain: game?.mountainId || '', day: game?.day || 0,
        seconds, version: GAME_VERSION, test: test || source.source === 'qa' }
      const body = JSON.stringify(payload)
      if (navigator.sendBeacon?.('/api/events', new Blob([body], { type: 'application/json' }))) return
      void fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
    }
    track('page_view')
    // Explicit installation avoids relying on proxy injection for Worker assets.
    if (!test && !document.querySelector('script[src*="cloudflareinsights.com/beacon"]')) {
      const script = document.createElement('script')
      script.src = 'https://static.cloudflareinsights.com/beacon.min.js'
      script.defer = true
      script.dataset.cfBeacon = JSON.stringify({ token: '917fbb2828ce4197b58846ef09c8c0ee' })
      document.head.append(script)
    }
    let lastInput = Date.now(), lastTick = Date.now(), seconds = 0
    let previous: GameInfo | null = getGame()
    let eligible = document.visibilityState === 'visible' && document.hasFocus() && !!previous
    const input = () => { lastInput = Date.now() }
    for (const event of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']) window.addEventListener(event, input, { passive: true })
    const flush = () => {
      const whole = Math.floor(seconds)
      if (whole && previous) { send?.('active_time', previous, Math.min(whole, 60)); seconds -= whole }
    }
    const sample = () => {
      const now = Date.now(), game = getGame()
      const active = document.visibilityState === 'visible' && document.hasFocus() && !!game
      seconds += activeDelta(now, lastTick, lastInput, eligible && active)
      if (!game || !active || game.mountainId !== previous?.mountainId || game.day !== previous?.day || seconds >= 30) flush()
      previous = game; eligible = active; lastTick = now
    }
    setInterval(sample, 1000)
    document.addEventListener('visibilitychange', () => { sample(); if (document.hidden) flush() })
    window.addEventListener('blur', () => { sample(); flush() })
    window.addEventListener('pagehide', () => { sample(); flush() })
  } catch { send = undefined }
}
