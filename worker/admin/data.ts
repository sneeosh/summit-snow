export interface Summary {
  visits: number; players: number; playing_visits: number; opened_visits: number; completed_visits: number;
  active_minutes: number; returning_players: number; continue_visits: number
}
export interface Daily { date: string; visits: number; players: number; active_minutes: number }
export interface Source { source: string; medium: string; campaign: string; content: string; visits: number; playing_visits: number; active_minutes: number }
export interface Mountain { mountain: string; players: number; active_minutes: number }
export interface DashboardData { days: number; start: string; updated: string; summary: Summary; daily: Daily[]; sources: Source[]; mountains: Mountain[] }
export const ADMIN_QUERIES = {
 summary: `WITH filtered AS (SELECT * FROM events WHERE test=0 AND received_at>=?),
 player_days AS (SELECT player,COUNT(DISTINCT date(received_at)) AS days FROM filtered WHERE event IN ('new_game','continue_game','active_time') GROUP BY player)
 SELECT COUNT(DISTINCT CASE WHEN event='page_view' THEN visit END) AS visits,
 COUNT(DISTINCT CASE WHEN event IN ('new_game','continue_game','active_time') THEN player END) AS players,
 COUNT(DISTINCT CASE WHEN event IN ('new_game','continue_game') THEN visit END) AS playing_visits,
 COUNT(DISTINCT CASE WHEN event='resort_opened' THEN visit END) AS opened_visits,
 COUNT(DISTINCT CASE WHEN event='day_completed' THEN visit END) AS completed_visits,
 COUNT(DISTINCT CASE WHEN event='continue_game' THEN visit END) AS continue_visits,
 COALESCE(SUM(seconds)/60.0,0) AS active_minutes,
 (SELECT COUNT(*) FROM player_days WHERE days>1) AS returning_players FROM filtered`,
 daily: `SELECT date(received_at) AS date,
 COUNT(DISTINCT CASE WHEN event='page_view' THEN visit END) AS visits,
 COUNT(DISTINCT CASE WHEN event IN ('new_game','continue_game','active_time') THEN player END) AS players,
 COALESCE(SUM(seconds)/60.0,0) AS active_minutes FROM events
 WHERE test=0 AND received_at>=? GROUP BY date(received_at) ORDER BY date`,
 sources: `SELECT source,medium,campaign,content,
 COUNT(DISTINCT CASE WHEN event='page_view' THEN visit END) AS visits,
 COUNT(DISTINCT CASE WHEN event IN ('new_game','continue_game') THEN visit END) AS playing_visits,
 COALESCE(SUM(seconds)/60.0,0) AS active_minutes FROM events WHERE test=0 AND received_at>=?
 GROUP BY source,medium,campaign,content ORDER BY visits DESC,playing_visits DESC,source LIMIT 25`,
 mountains: `SELECT mountain,COUNT(DISTINCT player) AS players,COALESCE(SUM(seconds)/60.0,0) AS active_minutes
 FROM events WHERE test=0 AND received_at>=? AND mountain<>'' AND event IN ('new_game','continue_game','active_time')
 GROUP BY mountain ORDER BY players DESC,mountain LIMIT 20`,
}
export function rangeStart(days: number, now: Date): string {
  const start = new Date(now); start.setUTCHours(0,0,0,0); start.setUTCDate(start.getUTCDate() - days + 1)
  return start.toISOString().slice(0,19).replace('T',' ')
}
export function fillDays(rows: Daily[], days: number, now: Date): Daily[] {
  const start = new Date(rangeStart(days, now).replace(' ','T')+'Z')
  const byDate = new Map(rows.map(r => [r.date,r]))
  return Array.from({length:days},(_,i) => {
    const date = new Date(start.getTime()+i*86400000).toISOString().slice(0,10)
    return byDate.get(date) ?? {date,visits:0,players:0,active_minutes:0}
  })
}
export async function getDashboard(db: D1Database, days: number, now = new Date()): Promise<DashboardData> {
  const start = rangeStart(days,now)
  const results = await db.batch<Summary | Daily | Source | Mountain>(Object.values(ADMIN_QUERIES).map(sql=>db.prepare(sql).bind(start)))
  if (results.some(r=>!r.success)) throw new Error('Dashboard query failed')
  return {days,start,updated:now.toISOString(),summary:results[0].results[0] as Summary,
    daily:fillDays(results[1].results as Daily[],days,now),
    sources:results[2].results as Source[],mountains:results[3].results as Mountain[]}
}
