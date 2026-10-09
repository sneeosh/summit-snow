export interface FeedbackEnv {
  FEEDBACK_GITHUB_TOKEN?: string
  EVENT_LIMIT: { limit(input: { key: string }): Promise<{ success: boolean }> }
}
export async function feedback(request: Request, env: FeedbackEnv): Promise<Response> {
  const respond = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } })
  if (request.method !== 'POST') return respond(405)
  if (request.headers.get('Origin') !== new URL(request.url).origin) return respond(403)
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return respond(415)
  if (!(await env.EVENT_LIMIT.limit({ key: `feedback:${request.headers.get('CF-Connecting-IP') || 'unknown'}` })).success) return respond(429)
  const reader = request.body?.getReader()
  if (!reader) return respond(400)
  let body = '', size = 0
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 16000) { await reader.cancel(); return respond(413) }
    body += decoder.decode(value, { stream: true })
  }
  body += decoder.decode()
  let input
  try { input = JSON.parse(body) } catch { return respond(400) }
  if (!input || typeof input.description !== 'string' || input.description.trim().length < 5 || input.description.length > 4000 ||
      typeof input.diagnostics !== 'string' || input.diagnostics.length > 6000) return respond(400)
  if (!env.FEEDBACK_GITHUB_TOKEN) return respond(503)
  try {
    const result = await fetch('https://api.github.com/repos/sneeosh/summit-snow/issues', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${env.FEEDBACK_GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'Summit-Snow-Feedback' },
      body: JSON.stringify({ title: `[bug] ${input.description.trim().split('\n')[0].slice(0, 100)}`,
        body: `${input.description}\n\n---\nClient diagnostics (player supplied):\n\n${input.diagnostics}\n\n_Filed from the in-game report form._` }),
    })
    return respond(result.ok ? 201 : 502)
  } catch { return respond(502) }
}
