import React,{useEffect,useState} from 'react'
import {createRoot} from 'react-dom/client'
import App from '../../src/App'
import '../../src/index.css'
import {useStore} from '../../src/state/store'
import {ensureMountain} from '../../src/content/mountain'
import {captureState,readCapture,stateDigest} from './capture'
import {GraphicsControl} from './GraphicsControl'
import {reviewTiming} from '../../src/rendering/reviewTiming'
import {checkTouchPaths} from './touch-check'
import type {GameState} from '../../src/game/types'

const BUILD=import.meta.env.VITE_BUILD_ID
function restore(g:GameState){
 ensureMountain(g.mountainId,g.mountainVersion)
 useStore.setState({game:g,screen:'playing',worldView:'mountain',speed:0,selection:null,buildMode:null,leftTab:null,bottomTab:null,showReport:g.phase==='day-end'})
}
export function Review(){
 const [note,setNote]=useState(''),[status,setStatus]=useState(''),[fixture,setFixture]=useState('opening')
 const [frozen,setFrozen]=useState<string|null>(null),[capture,setCapture]=useState(''),[url,setUrl]=useState('')
 const [touch,setTouch]=useState(''),[graphicsControl,setGraphicsControl]=useState(false)
 const [metric,setMetric]=useState(''),[measuring,setMeasuring]=useState(false)
 const phone=new URLSearchParams(location.search).get('phone')
 useEffect(()=>{if(!capture){setUrl('');return}const u=URL.createObjectURL(new Blob([capture],{type:'application/json'}));setUrl(u);return()=>URL.revokeObjectURL(u)},[capture])
 useEffect(()=>{
  if(!measuring)return
  reviewTiming.samples=[];reviewTiming.enabled=true
  let raf=0,last=0,started=0;const samples:number[]=[]
  const step=(now:number)=>{
   if(!started)started=now
   if(last&&now-started>500)samples.push(now-last);last=now
   if(now-started<10500||samples.length<2){raf=requestAnimationFrame(step);return}
   const sorted=[...samples].sort((a,b)=>a-b),mean=samples.reduce((a,b)=>a+b,0)/samples.length
   const g=useStore.getState().game
   const cpu=[...reviewTiming.samples].sort((a,b)=>a-b);reviewTiming.enabled=false
   const cpuNote=cpu.length?` · scene update CPU p95 ${cpu[Math.floor(cpu.length*.95)].toFixed(2)} ms (${cpu.length} samples)`:' · no mountain renderer'
   setMetric(`${samples.length} frames · ${(1000/mean).toFixed(1)} FPS · median ${sorted[Math.floor(sorted.length*.5)].toFixed(1)} ms · p95 ${sorted[Math.floor(sorted.length*.95)].toFixed(1)} ms · ${samples.filter(v=>v>33.4).length} over 33 ms · ${Object.keys(g?.guests??{}).length} live guests · ${innerWidth}×${innerHeight} · ${document.visibilityState}${cpuNote}`)
   setMeasuring(false)
  };raf=requestAnimationFrame(step);return()=>{cancelAnimationFrame(raf);reviewTiming.enabled=false}
 },[measuring])
 async function loadFixture(){
  try{const response=await fetch(`/winter-review/${fixture}.json`);if(!response.ok)throw Error('Generate fixtures first.')
  restore(await response.json());setFrozen(null);setCapture('');setStatus(`${fixture} loaded paused.`)}catch(e){setStatus(String(e))}
 }
 async function freeze(){
  useStore.getState().setSpeed(0);const g=useStore.getState().game;if(!g)return
  const c=await captureState(BUILD,g,note);setFrozen(JSON.stringify(c.state));setCapture(JSON.stringify(c));setStatus(`Frozen day ${c.state.day} · ${c.state.minute} min · seed ${c.seed} · checksum ${c.digest.slice(0,12)}`)
 }
 async function exportCapture(){
  const g=useStore.getState().game;if(!g)return
  const c=await captureState(BUILD,JSON.parse(frozen??JSON.stringify(g)),note);setCapture(JSON.stringify(c));setStatus('Capture ready. Use Download capture; keep this build for replay.')
 }
 async function importCapture(text:string){
  try{const c=await readCapture(text,BUILD);restore(c.state);setFrozen(JSON.stringify(c.state));setCapture(text)
   const same=await stateDigest(useStore.getState().game!)===c.digest
   setStatus(`Restored day ${c.state.day} · ${c.state.minute} min · seed ${c.seed} · checksum ${c.digest.slice(0,12)} · exact state ${same?'MATCH':'MISMATCH'}`)
  }catch(e){setStatus(e instanceof Error?e.message:String(e))}
 }
 if(phone)return <main style={{background:'#c6d4d8',minHeight:'100vh',padding:12}}><p>Responsive viewport: {phone} × 844. Desktop pointer, not physical touch hardware. <a href={location.pathname}>Desktop review</a></p><iframe title="Phone review" src={location.pathname} style={{display:'block',width:Number(phone),height:844,maxWidth:'100%',border:'1px solid #507066',margin:'12px auto'}}/></main>
 return <>{graphicsControl?<GraphicsControl/>:<App/>}<details style={{position:'fixed',left:8,bottom:8,zIndex:100,maxWidth:'min(320px,calc(100vw - 16px))',maxHeight:'70vh',overflow:'auto',background:'#f9fbf8',padding:10,border:'1px solid #507066',borderRadius:12,fontSize:12}}><summary>Playtest bench · {BUILD}</summary><div className="flex flex-col gap-2 mt-2">
 <p>Seed 91; recovery is a controlled thin-cover scene.</p><select aria-label="Showcase scene" value={fixture} onChange={e=>setFixture(e.target.value)}>{['opening','busy','recovery','finale','ending'].map(f=><option key={f}>{f}</option>)}</select><button className="btn btn-ghost" onClick={loadFixture}>Load scene</button>
 <textarea aria-label="Playtest feedback" value={note} onChange={e=>setNote(e.target.value)} placeholder="What happened?"/>
 <button className="btn btn-ghost" onClick={freeze}>Freeze feedback state</button><button className="btn btn-ghost" onClick={exportCapture}>Prepare feedback download</button>
 {url&&<a className="btn btn-primary" href={url} download="summit-feedback.json">Download capture</a>}
 <label>Restore feedback file<input type="file" accept="application/json" onChange={async e=>{const f=e.target.files?.[0];if(f)await importCapture(await f.text());e.target.value=''}}/></label>
 <details><summary>Copyable capture / paste restore</summary><textarea aria-label="Capture JSON" value={capture} onChange={e=>setCapture(e.target.value)}/><button onClick={()=>importCapture(capture)}>Restore pasted capture</button></details>
 <p role="status">{status}</p><button className="btn btn-ghost" disabled={measuring} onClick={()=>{setMetric('Sampling 10 seconds after warmup…');setMeasuring(true)}}>Measure frame times</button><output aria-label="Frame timing results">{metric}</output>
 <button className="btn btn-ghost" onClick={()=>setTouch(checkTouchPaths())}>Check synthetic touch paths</button><output aria-label="Touch check results">{touch}</output>
 <button className="btn btn-ghost" onClick={()=>{useStore.getState().setSpeed(0);setGraphicsControl(v=>!v)}}>{graphicsControl?'Return to game':'Independent WebGL control'}</button>
 <a href="?phone=390">Phone 390 × 844</a><a href="?phone=360">Phone 360 × 844</a></div></details></>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Review/></React.StrictMode>)
