import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import App from '../../src/App'
import '../../src/index.css'
import {useStore} from '../../src/state/store'
import {ensureMountain} from '../../src/content/mountain'
import {loadGame} from '../../src/state/save'

const BUILD=import.meta.env.VITE_BUILD_ID
function Review(){
 const [note,setNote]=useState(''),[status,setStatus]=useState(''),[fixture,setFixture]=useState('opening')
 const [frozen,setFrozen]=useState<string|null>(null)
 async function loadFixture(){
  const response=await fetch(`/winter-review/${fixture}.json`)
  if(!response.ok){setStatus('Generate fixtures with npm run playtest:showcase first.');return}
  const g=await response.json()
  ensureMountain(g.mountainId,g.mountainVersion)
  useStore.setState({game:g,screen:'playing',worldView:'mountain',speed:0,selection:null,buildMode:null,leftTab:null,bottomTab:null,showReport:g.phase==='day-end'})
  setStatus(`${fixture} · seed ${g.seed} · day ${g.day}`)
 }
 function download(){
  const g=useStore.getState().game;if(!g)return
  const body=JSON.stringify({build:BUILD,seed:g.seed,feedback:note,state:JSON.parse(frozen??JSON.stringify(g))},null,2)
  const url=URL.createObjectURL(new Blob([body],{type:'application/json'}))
  const a=document.createElement('a');a.href=url;a.download=`summit-feedback-${g.seed}-day${g.day}.json`;a.click();URL.revokeObjectURL(url)
 }
 return <><App/><details style={{position:'fixed',left:8,top:110,zIndex:100,maxWidth:300,background:'#f9fbf8',padding:10,border:'1px solid #507066',borderRadius:12,fontSize:12}}><summary>Playtest bench · {BUILD}</summary><p>Scenario scenes use real actions and seed 91. Recovery is a controlled thin-cover fixture.</p><select aria-label="Showcase scene" value={fixture} onChange={e=>setFixture(e.target.value)}>{['opening','busy','recovery','finale','ending'].map(f=><option key={f}>{f}</option>)}</select><button onClick={loadFixture}>Load scene</button><button onClick={()=>{useStore.getState().setSpeed(0);setFrozen(JSON.stringify(useStore.getState().game));setStatus('Exact state frozen for feedback.')}}>Freeze feedback state</button><textarea aria-label="Playtest feedback" value={note} onChange={e=>setNote(e.target.value)} placeholder="What happened? What did you expect?"/><button onClick={download}>Export feedback + save</button><label>Restore feedback file<input type="file" accept="application/json" onChange={async e=>{try{const file=e.target.files?.[0];if(!file)return;const envelope=JSON.parse(await file.text());if(envelope.build!==BUILD){setStatus('Build mismatch: use the recorded commit and source fingerprint.');return}localStorage.setItem('summit-snow:save:review-import',JSON.stringify({version:envelope.state.version,label:'Review import',state:envelope.state}));const g=loadGame('review-import');if(!g)throw Error('Invalid save');ensureMountain(g.mountainId,g.mountainVersion);useStore.setState({game:g,screen:'playing',speed:0,showReport:g.phase==='day-end'});setStatus('Restored paused at exact state.')}catch{setStatus('Could not restore this file.')}}}/></label><p>{status}</p></details></>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Review/></React.StrictMode>)
