import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
export interface AccessConfig { ACCESS_TEAM_DOMAIN: string; ACCESS_AUD: string; ADMIN_EMAILS: string }
export async function verifyAdminToken(token: string, config: AccessConfig, key?: JWTVerifyGetKey): Promise<boolean> {
  if (!config.ACCESS_AUD || !config.ACCESS_TEAM_DOMAIN || !config.ADMIN_EMAILS || !token) return false
  try {
    const issuer = new URL(config.ACCESS_TEAM_DOMAIN)
    if (issuer.protocol !== 'https:' || !issuer.hostname.endsWith('.cloudflareaccess.com') || issuer.pathname !== '/') return false
    const keys = key ?? createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer), { timeoutDuration: 5000 })
    const { payload } = await jwtVerify(token, keys, { issuer: issuer.origin, audience: config.ACCESS_AUD,
      algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub', 'email'] })
    return typeof payload.email === 'string' && config.ADMIN_EMAILS.split(',').map(x => x.trim().toLowerCase()).includes(payload.email.toLowerCase())
  } catch { return false }
}
