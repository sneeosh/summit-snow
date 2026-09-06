"""Integration checks against the local Worker; does not touch production."""
import json, urllib.request, urllib.error, uuid, sqlite3
from pathlib import Path
base='http://localhost:8787'
event=dict(id=str(uuid.uuid4()),player=str(uuid.uuid4()),visit=str(uuid.uuid4()),event='page_view',source='qa',medium='',campaign='endpoint-check',content='',mode='',mountain='',day=0,seconds=0,version='0.1.0',test=True)
def post(body,origin=base):
    req=urllib.request.Request(base+'/api/events',data=body,headers={'Content-Type':'application/json','Origin':origin})
    try:
        with urllib.request.urlopen(req) as r: return r.status
    except urllib.error.HTTPError as e: return e.code
body=json.dumps(event).encode()
assert post(body)==204
assert post(body)==204 # idempotent same event ID
assert post(body,'https://example.com')==403
assert post(b'{bad')==400
assert post(b'x'*4097)==413
assert post(json.dumps(dict(event,event='bad')).encode())==400
# Use the exact migration in SQLite for report semantics.
db=sqlite3.connect(':memory:')
db.executescript(Path('migrations/0001_analytics.sql').read_text())
def add(player,visit,event,ago=0,test=0,seconds=0):
    db.execute("INSERT INTO events VALUES (?,datetime('now',?),?,?,?,?,?,?,?,?,?,?,?,?,?)",(str(uuid.uuid4()),f'-{ago} days',player,visit,event,'linkedin','social','launch','clip','scenario','alder',1,seconds,'0.1.0',test))
add('a','1','page_view',1);add('a','1','new_game',1);add('a','1','day_completed',1)
add('a','2','page_view');add('a','2','continue_game');add('a','2','active_time',seconds=30)
add('b','3','page_view');add('b','3','new_game');add('b','4','page_view');add('b','4','continue_game')
add('test','5','page_view',test=1)
assert db.execute('SELECT players,returning_players FROM returning_players_30d').fetchone()==(2,1)
assert db.execute('SELECT visits,playing_visits,active_minutes FROM traffic_sources_30d').fetchone()==(4,4,0.5)
print('Endpoint validation and report/return-player semantics passed.')
