import { verifyAdminToken } from './auth'
import { getDashboard } from './data'
import { renderDashboard } from './render'
export async function admin(request: Request, env: Env): Promise<Response> {
  const headers = { 'Cache-Control':'private, no-store', 'X-Robots-Tag':'noindex, nofollow', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer', 'X-Frame-Options':'DENY' }
  const deny = () => new Response('Access denied', {status:403,headers})
  const url = new URL(request.url)
  // Admin is available only on the Access-protected custom hostname. No preview/local bypass.
  if (url.hostname !== 'ski.kennyatx.com' || url.protocol !== 'https:') return deny()
  if (!await verifyAdminToken(request.headers.get('Cf-Access-Jwt-Assertion') || '',env)) return deny()
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed',{status:405,headers:{...headers,Allow:'GET, HEAD'}})
  if (url.pathname !== '/admin' && url.pathname !== '/admin/') return new Response('Not found',{status:404,headers})
  const days = Number(url.searchParams.get('days') || 30)
  if (![7,30,90].includes(days)) return new Response('Choose 7, 30 or 90 days.',{status:400,headers})
  try {
    const data = await getDashboard(env.ANALYTICS_DB,days)
    const nonce = crypto.randomUUID()
    return new Response(request.method === 'HEAD' ? null : renderDashboard(data,nonce),{headers:{...headers,'Content-Type':'text/html; charset=utf-8',
      'Content-Security-Policy':`default-src 'none'; style-src 'nonce-${nonce}'; style-src-attr 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`}})
  } catch { console.error(JSON.stringify({event:'admin_query_failed'})); return new Response('Analytics are temporarily unavailable. Please refresh shortly.',{status:503,headers}) }
}
