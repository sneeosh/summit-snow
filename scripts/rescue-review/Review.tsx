import {useEffect,useRef,useState} from 'react'
import {Application,Graphics} from 'pixi.js'
import {newGame} from '../../src/game/init'
import {spawnArrivals,handleIncident} from '../../src/game/guests'
import {Rng} from '../../src/game/rng'
import {tick} from '../../src/game/simulation'
import {rescueProgress} from '../../src/game/rescue'
import {paintRescues} from '../../src/rendering/rescues'
import {MountainCanvas} from '../../src/rendering/MountainCanvas'
import {useStore} from '../../src/state/store'
import '../../src/index.css'
function fixture(){
 for(let seed=1;seed<1000;seed++){
  const s=newGame('sandbox',91,'alder');s.phase='operating';s.minute=600;s.arrivalCarry=1;s.targetDemandToday=0
  spawnArrivals(s,new Rng(4))
  const guest=Object.values(s.guests)[0],trail=Object.values(s.trails).find(t=>t.built)!
  guest.pos={x:1000,y:800};guest.objective='skiing';guest.routeTrailId=trail.trailId;trail.skierIds=[guest.id]
  handleIncident(s,guest,new Rng(seed))
  if(s.rescuesToday[0]?.transport==='helicopter')return s
 }
 throw Error('No helicopter fixture seed')
}
const initial=fixture(),cashBefore=initial.cash+initial.rescuesToday[0].cost
export function Review(){
 const [elapsed,setElapsed]=useState(0),[playing,setPlaying]=useState(false)
 const host=useRef<HTMLDivElement>(null),appRef=useRef<Application|null>(null),graphic=useRef<Graphics|null>(null)
 const state=structuredClone(initial)
 for(let i=0;i<elapsed*4;i++)tick(state)
 const rescue=state.rescuesToday[0],motion=rescueProgress(rescue,state.minute)
 useEffect(()=>{useStore.setState({game:state,screen:'playing',speed:0,leftTab:null,bottomTab:null})
  if(graphic.current){const g=graphic.current;paintRescues(g,state,false);g.scale.set(3);g.position.set(205-motion.position.x*3,260-motion.position.y*3)}
 },[elapsed])
 useEffect(()=>{if(!playing)return;const timer=setInterval(()=>setElapsed(e=>{if(e>=25){setPlaying(false);return e}return e+.25}),180);return()=>clearInterval(timer)},[playing])
 useEffect(()=>{let disposed=false;const app=new Application();app.init({width:440,height:340,background:'#e1edf1',antialias:true,resolution:1}).then(()=>{if(disposed){app.destroy(true);return}host.current!.appendChild(app.canvas);appRef.current=app;const g=new Graphics();graphic.current=g;app.stage.addChild(g);paintRescues(g,initial,false);g.scale.set(3);g.position.set(205-1000*3,260-800*3)});return()=>{disposed=true;appRef.current?.destroy(true)}},[])
 return <main style={{height:'100vh',position:'relative'}}><MountainCanvas/>
 <header style={{position:'absolute',top:20,left:20,right:20,padding:18,borderRadius:16,background:'#f4f8fa',boxShadow:'0 4px 20px #4563'}}>
 <h1 style={{fontSize:24,fontFamily:'Georgia'}}>🚁 Helicopter rescue · controlled playtest</h1>
 <p>Actual game simulation and renderer · Mount Alder · compound fracture</p>
 <nav style={{display:'flex',gap:8,marginTop:12}}>{[[0,'Dispatch'],[8,'Treatment'],[14,'Air evacuation'],[20,'Completed']].map(([time,label])=><button className="btn" key={time} onClick={()=>{setPlaying(false);setElapsed(Number(time))}}>{label}</button>)}<button className="btn btn-primary" onClick={()=>setPlaying(!playing)}>{playing?'Pause animation':'Play animation'}</button></nav>
 </header>
 <aside style={{position:'absolute',right:20,top:185,width:480,padding:20,borderRadius:16,background:'#f4f8fa',boxShadow:'0 4px 20px #4563'}}>
 <h2 style={{fontSize:22,fontFamily:'Georgia'}}>{motion.stage}</h2><p>{elapsed.toFixed(2)} simulation minutes since dispatch</p><div ref={host} style={{marginTop:12,borderRadius:12,overflow:'hidden'}}/>
 <p style={{marginTop:12}}>Dispatch charge: <strong>${rescue.cost.toLocaleString()}</strong></p><p>Cash: ${cashBefore.toLocaleString()} → <strong>${state.cash.toLocaleString()}</strong></p><p>Rescue completed: <strong>{rescue.completed?'Yes':'No'}</strong></p>
 <p style={{marginTop:10,fontSize:12}}>Magnified view uses the same rescue renderer as the mountain. Stage buttons advance normal simulation ticks from a seeded accident fixture.</p>
 </aside></main>
}
