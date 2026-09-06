import { admin } from './admin'
import { validateEvent } from '../src/analytics/schema'
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) return admin(request, env)
    if (url.pathname !== '/api/events') return env.ASSETS.fetch(request)
    const respond = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } })
    if (request.method !== 'POST') return respond(405)
    if (request.headers.get('Origin') !== url.origin) return respond(403)
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) return respond(415)
    // IP is used only by the ephemeral limiter, never persisted to the analytics database.
    const limit = await env.EVENT_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' })
    if (!limit.success) return respond(429)
    const reader = request.body?.getReader()
    if (!reader) return respond(400)
    let length = 0, body = ''
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > 4096) { await reader.cancel(); return respond(413) }
      body += decoder.decode(value, { stream: true })
    }
    body += decoder.decode()
    let event
    try { event = validateEvent(JSON.parse(body)) } catch { return respond(400) }
    if (!event) return respond(400)
    try {
      await env.ANALYTICS_DB.prepare(`INSERT OR IGNORE INTO events
        (id, player, visit, event, source, medium, campaign, content, mode, mountain, day, seconds, version, test)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(event.id, event.player, event.visit, event.event, event.source, event.medium, event.campaign,
          event.content, event.mode, event.mountain, event.day, event.seconds, event.version,
          event.test || url.hostname !== 'ski.kennyatx.com' ? 1 : 0).run()
      return respond(204)
    } catch { console.error(JSON.stringify({ event: 'analytics_write_failed' })); return respond(503) }
  },
  async scheduled(_controller, env) {
    await env.ANALYTICS_DB.prepare("DELETE FROM events WHERE received_at < datetime('now', '-90 days')").run()
  },
} satisfies ExportedHandler<Env>
