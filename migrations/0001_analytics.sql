CREATE TABLE events (
 id TEXT PRIMARY KEY, received_at TEXT NOT NULL DEFAULT (datetime('now')),
 player TEXT NOT NULL, visit TEXT NOT NULL, event TEXT NOT NULL,
 source TEXT NOT NULL, medium TEXT NOT NULL, campaign TEXT NOT NULL, content TEXT NOT NULL,
 mode TEXT NOT NULL, mountain TEXT NOT NULL, day INTEGER NOT NULL, seconds INTEGER NOT NULL,
 version TEXT NOT NULL, test INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX events_time ON events(received_at);
CREATE INDEX events_player ON events(player, received_at);
CREATE INDEX events_visit ON events(visit);
CREATE VIEW traffic_sources_30d AS
SELECT source, medium, campaign, content,
 COUNT(DISTINCT CASE WHEN event='page_view' THEN visit END) AS visits,
 COUNT(DISTINCT CASE WHEN event IN ('new_game','continue_game') THEN visit END) AS playing_visits,
 COUNT(DISTINCT CASE WHEN event='new_game' THEN visit END) AS new_game_visits,
 COUNT(DISTINCT CASE WHEN event='continue_game' THEN visit END) AS continue_visits,
 COUNT(DISTINCT CASE WHEN event='resort_opened' THEN visit END) AS opened_resort_visits,
 COUNT(DISTINCT CASE WHEN event='day_completed' THEN visit END) AS completed_day_visits,
 ROUND(SUM(seconds)/60.0,1) AS active_minutes,
 ROUND(100.0*COUNT(DISTINCT CASE WHEN event IN ('new_game','continue_game') THEN visit END)/NULLIF(COUNT(DISTINCT CASE WHEN event='page_view' THEN visit END),0),1) AS play_conversion_pct
FROM events WHERE test=0 AND received_at >= datetime('now','-30 days') GROUP BY source,medium,campaign,content;
CREATE VIEW daily_usage AS
SELECT date(received_at) AS date,
 COUNT(DISTINCT CASE WHEN event='page_view' THEN visit END) AS visits,
 COUNT(DISTINCT CASE WHEN event IN ('new_game','continue_game','active_time') THEN player END) AS players,
 COUNT(DISTINCT CASE WHEN event='new_game' THEN visit END) AS new_game_visits,
 COUNT(DISTINCT CASE WHEN event='continue_game' THEN visit END) AS continue_visits,
 COUNT(DISTINCT CASE WHEN event='resort_opened' THEN visit END) AS opened_resort_visits,
 COUNT(DISTINCT CASE WHEN event='day_completed' THEN visit END) AS completed_day_visits,
 ROUND(SUM(seconds)/60.0,1) AS active_minutes
FROM events WHERE test=0 GROUP BY date(received_at);
CREATE VIEW returning_players_30d AS
WITH days AS (SELECT DISTINCT player,date(received_at) AS played_date FROM events
 WHERE test=0 AND event IN ('new_game','continue_game','active_time') AND received_at >= datetime('now','-30 days')),
 counts AS (SELECT player,COUNT(*) AS played_days FROM days GROUP BY player)
SELECT COUNT(*) AS players, COALESCE(SUM(played_days>1),0) AS returning_players,
 ROUND(100.0*SUM(played_days>1)/NULLIF(COUNT(*),0),1) AS returning_player_pct FROM counts;
