import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { TownScene } from '../../src/components/TownScene'
import { newGame } from '../../src/game/init'
import { MOUNTAINS } from '../../src/content/mountains'
import '../../src/index.css'
export function Review() {
 const [level,setLevel]=useState(3)
 const [night,setNight]=useState(false)
 const [construction,setConstruction]=useState(false)
 return <main style={{height:'100vh',overflow:'auto',padding:16,background:'#edf0e7'}}>
  <header style={{position:'sticky',top:0,zIndex:5,background:'white',padding:12,display:'flex',gap:20}}>
   {[0,1,2,3].map(n=><button key={n} onClick={()=>setLevel(n)}>Level {n}{n===level?' ✓':''}</button>)}
   <button onClick={()=>setNight(!night)}>{night?'Dawn':'Dusk'}</button>
   <button onClick={()=>setConstruction(!construction)}>Construction {construction?'on':'off'}</button>
  </header>
  <div style={{display:'grid',gridTemplateColumns:'repeat(2,600px)',gap:12}}>{(construction?MOUNTAINS.slice(0,1):MOUNTAINS).map(m=>{const game=newGame('sandbox',12,m.id);game.town.levels={housing:level,mainstreet:level,inn:level,shuttle:level};game.town.compactHomes=level;game.town.policies={winterMarket:level>0,darkSky:night};game.minute=night?1000:510;game.weatherSeason[0].snowfallCm=2;
   return <section key={m.id}><h2>{m.name} · Level {level}</h2><div style={{width:600,height:340}}><TownScene game={game} still/></div>{construction&&(['housing','mainstreet','inn','shuttle'] as const).map(project=>{const building={...game,town:{...game.town,construction:{project,homes:false,remainingDays:1,totalDays:3}}};return <div key={project}><h3>{project} construction</h3><div style={{width:600,height:340}}><TownScene game={building} still/></div></div>})}</section>
  })}</div>
 </main>
}
createRoot(document.getElementById('root')!).render(<Review/> )
