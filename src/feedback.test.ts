import { afterEach, describe, expect, it, vi } from 'vitest'
import { feedback } from '../worker/feedback'
const request = (body: unknown = { description: 'Mountain went black', diagnostics: '{"version":"0.1.1"}' }, origin = 'https://ski.kennyatx.com') => new Request('https://ski.kennyatx.com/api/feedback', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const env = () => ({ FEEDBACK_GITHUB_TOKEN: 'test-token', EVENT_LIMIT: { limit: vi.fn(async () => ({ success: true })) } })
afterEach(() => vi.unstubAllGlobals())
describe('feedback route', () => {
  it('submits to the fixed repo only after validation', async () => {
    const send = vi.fn(async () => new Response(null, { status: 201 })); vi.stubGlobal('fetch', send)
    expect((await feedback(request(), env())).status).toBe(201)
    expect(send).toHaveBeenCalledWith('https://api.github.com/repos/sneeosh/summit-snow/issues', expect.objectContaining({ method: 'POST' }))
  })
  it('does not claim success when a secret is absent or GitHub fails', async () => {
    const e = env(); e.FEEDBACK_GITHUB_TOKEN = ''
    expect((await feedback(request(), e)).status).toBe(503)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })))
    expect((await feedback(request(), env())).status).toBe(502)
  })
  it('rejects cross-origin, malformed and oversized reports before GitHub', async () => {
    const send = vi.fn(); vi.stubGlobal('fetch', send)
    expect((await feedback(request({}, 'https://other.test'), env())).status).toBe(403)
    expect((await feedback(request({ description: 'bad' }), env())).status).toBe(400)
    expect((await feedback(request({ description: 'x'.repeat(17000) }), env())).status).toBe(413)
    expect(send).not.toHaveBeenCalled()
  })
  it('respects rate limits', async () => {
    const e = env(); e.EVENT_LIMIT.limit.mockResolvedValue({ success: false })
    expect((await feedback(request(), e)).status).toBe(429)
  })
})
