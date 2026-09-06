import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, writeFileSync } from 'node:fs'
import * as auth from './auth'
import { admin } from './index'
import { ADMIN_QUERIES, fillDays, rangeStart, type DashboardData, type Summary } from './data'
import { renderDashboard } from './render'
const config = {
 ACCESS_TEAM_DOMAIN:'https://kennyatx.cloudflareaccess.com',
 ACCESS_AUD:'b0b8c1ca86ec698b2d453c01a9b28e85c3027155db8ef70934c4bedb698dea30',
 ADMIN_EMAILS:'kennyallenjohnson@gmail.com,kjohnson@cloudflare.com',
} as const
const keys=await generateKeyPair('RS256',{extractable:true})
const publicJwk=await exportJWK(keys.publicKey)
const jwks=createLocalJWKSet({keys:[{...publicJwk,kid:'test'}]})
async function token(email='kennyallenjohnson@gmail.com',audience=config.ACCESS_AUD as string,exp='1h',issuer=config.ACCESS_TEAM_DOMAIN as string) {
 return new SignJWT({email}).setProtectedHeader({alg:'RS256',kid:'test'}).setAudience(audience).setIssuer(issuer).setSubject('test-user').setIssuedAt().setExpirationTime(exp).sign(keys.privateKey)
}
afterEach(()=>vi.restoreAllMocks())
describe('Access verification',()=>{
 it.each(['kennyallenjohnson@gmail.com','kjohnson@cloudflare.com'])('permits signed allowed identity %s',async email=>{
  expect(await auth.verifyAdminToken(await token(email),config,jwks)).toBe(true)
 })
 it('rejects other identities, wrong audience/issuer, expiry, forgery and missing settings',async()=>{
  for(const t of [await token('someone@cloudflare.com'),await token(undefined,'another-app'),await token(undefined,undefined,'-1h'),await token(undefined,undefined,undefined,'https://other.cloudflareaccess.com'),'forged'])
   expect(await auth.verifyAdminToken(t,config,jwks)).toBe(false)
  expect(await auth.verifyAdminToken(await token(),{...config,ACCESS_AUD:''},jwks)).toBe(false)
  const evil=await generateKeyPair('RS256')
  const forged=await new SignJWT({email:'kennyallenjohnson@gmail.com'}).setProtectedHeader({alg:'RS256',kid:'test'}).setAudience(config.ACCESS_AUD).setIssuer(config.ACCESS_TEAM_DOMAIN).setSubject('x').setIssuedAt().setExpirationTime('1h').sign(evil.privateKey)
  expect(await auth.verifyAdminToken(forged,config,jwks)).toBe(false)
 })
})
function fixtureDb() {
 const db=new DatabaseSync(':memory:');db.exec(readFileSync('migrations/0001_analytics.sql','utf8'))
 const add=(player:string,visit:string,event:string,day:string,source='linkedin',test=0,seconds=0)=>db.prepare('INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),day,player,visit,event,source,'social','launch','clip-1','scenario','alder',1,seconds,'0.1.0',test)
 add('a','1','page_view','2026-09-05 14:00:00');add('a','1','new_game','2026-09-05 14:00:01');add('a','1','resort_opened','2026-09-05 14:00:02');add('a','1','day_completed','2026-09-05 14:00:03');add('a','1','active_time','2026-09-05 14:00:04','linkedin',0,30)
 add('a','2','page_view','2026-09-06 01:00:00');add('a','2','continue_game','2026-09-06 01:00:01')
 add('b','3','page_view','2026-09-06 01:00:00','x');add('b','3','new_game','2026-09-06 01:00:01','x')
 add('b','4','page_view','2026-09-06 01:01:00','x');add('b','4','continue_game','2026-09-06 01:01:01','x')
 add('qa','qa','page_view','2026-09-06 01:00:00','qa',1);add('old','old','page_view','2026-01-01 01:00:00')
 return db
}
const now=new Date('2026-09-06T01:30:00Z')
const zero:Summary={visits:0,players:0,playing_visits:0,opened_visits:0,completed_visits:0,active_minutes:0,returning_players:0,continue_visits:0}
const empty:DashboardData={days:7,start:rangeStart(7,now),updated:now.toISOString(),summary:zero,daily:fillDays([],7,now),sources:[],mountains:[]}
it('queries actual SQLite data with correct source/return counts and excludes tests/out-of-range traffic',()=>{
 const db=fixtureDb(),start=rangeStart(7,now)
 const s=db.prepare(ADMIN_QUERIES.summary).get(start)
 expect(s).toMatchObject({visits:4,players:2,playing_visits:4,returning_players:1,continue_visits:2,active_minutes:0.5,completed_visits:1})
 expect(db.prepare(ADMIN_QUERIES.sources).all(start)).toHaveLength(2)
 expect(db.prepare(ADMIN_QUERIES.daily).all(start)).toHaveLength(2)
 expect(db.prepare(ADMIN_QUERIES.mountains).all(start)).toMatchObject([{mountain:'alder',players:2}])
 db.close()
})
it('fills UTC missing dates across month boundaries',()=>{
 const rows=fillDays([],7,new Date('2026-09-02T22:00:00Z'))
 expect(rows).toHaveLength(7);expect(rows[0].date).toBe('2026-08-27');expect(rows[6].date).toBe('2026-09-02')
})
it('renders honest empty states and escapes stored source names',()=>{
 expect(renderDashboard(empty,'nonce')).toContain('Your next players will show up here.')
 const html=renderDashboard({...empty,sources:[{source:'<img src=x onerror=alert(1)>',medium:'',campaign:'',content:'',visits:1,playing_visits:1,active_minutes:1}]},'nonce')
 expect(html).not.toContain('<img');expect(html).toContain('&lt;img');expect(html).not.toContain('<script')
})
it('rejects missing/forged auth and alternate hosts before querying data',async()=>{
 const batch=vi.fn()
 const db={batch} as unknown as D1Database
 const env={...config,ANALYTICS_DB:db,ASSETS:{} as Fetcher,EVENT_LIMIT:{} as RateLimit}
 for(const url of ['https://ski.kennyatx.com/admin','https://summit-snow.kennyatx1.workers.dev/admin','https://preview-summit-snow.kennyatx1.workers.dev/admin','http://localhost:8787/admin']) {
  expect((await admin(new Request(url),env)).status).toBe(403)
 }
 expect((await admin(new Request('https://ski.kennyatx.com/admin',{headers:{'Cf-Access-Jwt-Assertion':'forged'}}),env)).status).toBe(403)
 expect(batch).not.toHaveBeenCalled()
})
it('serves authorized HTML with no-store/CSP and rejects bad routes and periods',async()=>{
 vi.spyOn(auth,'verifyAdminToken').mockResolvedValue(true)
 const batch=vi.fn().mockResolvedValue([{success:true,results:[zero]},{success:true,results:[]},{success:true,results:[]},{success:true,results:[]}])
 const db={batch,prepare:()=>({bind:()=>({})})} as unknown as D1Database
 const env={...config,ANALYTICS_DB:db,ASSETS:{} as Fetcher,EVENT_LIMIT:{} as RateLimit}
 const r=await admin(new Request('https://ski.kennyatx.com/admin?days=7'),env)
 expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toContain('no-store');expect(r.headers.get('content-security-policy')).toContain("default-src 'none'")
 expect(await r.text()).toContain('Visits &amp; players')
 expect((await admin(new Request('https://ski.kennyatx.com/admin/data'),env)).status).toBe(404)
 expect((await admin(new Request('https://ski.kennyatx.com/admin?days=999'),env)).status).toBe(400)
 batch.mockRejectedValueOnce(new Error('DB error'))
 expect((await admin(new Request('https://ski.kennyatx.com/admin'),env)).status).toBe(503)
})
it('writes a non-production visual fixture for browser review',()=>{
 const daily=fillDays([],30,now).map((d,i)=>({...d,visits:i<23?0:18+(i-23)*11,players:i<23?0:7+(i-23)*4,active_minutes:i<23?0:10+(i-23)*6}))
 const populated:DashboardData={...empty,days:30,start:rangeStart(30,now),summary:{visits:357,players:104,playing_visits:142,opened_visits:89,completed_visits:52,active_minutes:684.5,returning_players:28,continue_visits:46},daily,
 sources:[{source:'linkedin',medium:'social',campaign:'launch',content:'clip-1',visits:167,playing_visits:64,active_minutes:310.5},{source:'x',medium:'social',campaign:'launch',content:'clip-2',visits:125,playing_visits:61,active_minutes:270},{source:'direct',medium:'',campaign:'',content:'',visits:65,playing_visits:17,active_minutes:104}],mountains:[{mountain:'alder',players:93,active_minutes:604},{mountain:'prairie',players:18,active_minutes:80.5}]}
 writeFileSync('/tmp/summit-admin-preview.html',renderDashboard(populated,'fixture'))
 writeFileSync('/tmp/summit-admin-empty.html',renderDashboard(empty,'fixture'))
})
