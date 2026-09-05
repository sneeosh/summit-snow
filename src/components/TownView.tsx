import { useEffect, useState } from 'react'
import { TOWN_POLICIES, TOWN_PROJECT_ORDER, TOWN_PROJECTS, TOWN_SEAT_LABELS } from '../content/town'
import { TOWN_HOMES_COMPACT_COST, TOWN_MAX_LEVEL } from '../content/balance'
import { MOUNTAIN_MAP } from '../content/mountains'
import { townPolicyProposal, townBenefits, townProposal, townStage } from '../game/town'
import type { TownProject, TownPolicy } from '../game/types'
import { formatMoney, useStore } from '../state/store'
import { TownScene, type TownCamera } from './TownScene'

export function TownView() {
 const game=useStore(s=>s.game)!
 const adopt=useStore(s=>s.adoptTownPolicy)
 const [memory,setMemory]=useState<number|null>(null)
 const [celebrating,setCelebrating]=useState(false)
 useEffect(()=>{if(!celebrating)return;const timer=setTimeout(()=>setCelebrating(false),8000);return()=>clearTimeout(timer)},[celebrating])
 const propose=useStore(s=>s.proposeTownProject)
 const [camera,setCamera]=useState<TownCamera>('panorama')
 const [project,setProject]=useState<TownProject>('housing')
 const [homes,setHomes]=useState(false)
 const benefits=townBenefits(game), proposal=townProposal(game,project,homes), spec=TOWN_PROJECTS[project]
 const construction=game.town.construction
 const opening=game.town.lastOpening?.day===game.day&&game.town.lastOpening?.season===game.season?game.town.lastOpening:null
 const snapshot = memory === null ? null : game.town.scrapbook[memory]
 const shown = snapshot ? { ...game, day: snapshot.day, season: snapshot.season, minute: 10*60, phase: 'planning' as const, town: { ...game.town, levels: snapshot.levels, policies: snapshot.policies, compactHomes: snapshot.compactHomes, construction: null, lastOpening: null } } : game
 return <div className="town-shell pointer-events-auto absolute inset-x-3 top-20 bottom-24 z-10 overflow-hidden rounded-2xl border border-white/50 bg-[#e9ece2] shadow-xl">
  <section className="town-panorama relative min-h-0 overflow-hidden bg-[#bdced1]">
   <TownScene game={shown} camera={camera} celebrating={celebrating&&!snapshot} still={!!snapshot}/>
   <div className="absolute left-4 top-4 rounded-xl bg-[#f5f1e6]/95 px-4 py-3 shadow-sm">
    <div className="text-[10px] uppercase tracking-[.2em] text-[#63776e]">{townStage(shown)}</div>
    <h2 className="font-serif text-[23px] text-[#294a40]">{MOUNTAIN_MAP[game.mountainId].name} Village</h2>
    <p className="text-[11px] text-[#68766b]">A town shaped together. A mountain to come home to.</p>
   </div>
   {opening&&!snapshot&&<div className="town-opening absolute bottom-16 left-4 rounded-xl border border-[#e4c776] bg-[#fff6d9] px-4 py-2 text-[#68542d] shadow-lg"><span className="text-[10px] font-bold uppercase tracking-widest">Now open</span><div className="font-serif text-lg">{TOWN_PROJECTS[opening.project].name} · Level {opening.level}</div><button className="mt-1 text-xs underline" onClick={()=>{setCelebrating(true);setCamera(opening.project==='housing'?'riverside':opening.project==='mainstreet'?'mainstreet':'station')}}>Visit the opening</button></div>}
   {snapshot&&<div className="absolute bottom-16 left-4 rounded-lg bg-[#fff6db] p-3 text-xs text-[#55674f]">{snapshot.label} · Winter {snapshot.season}, day {snapshot.day}<button onClick={()=>setMemory(null)} className="ml-3 underline">Back to today</button></div>}
   <nav aria-label="Town viewpoints" className="absolute bottom-3 left-1/2 flex max-w-[95%] -translate-x-1/2 gap-1 overflow-x-auto rounded-xl bg-[#f7f3e7]/95 p-1 shadow-md">
    {([['panorama','Panorama'],['mainstreet','Main Street'],['riverside','Riverside'],['station','Station Square']] as const).map(([id,label])=><button key={id} aria-pressed={camera===id} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[11px] ${camera===id?'bg-[#355b4d] text-[#faf0d4]':'text-[#4c675a] hover:bg-[#e1e5d6]'}`} onClick={()=>setCamera(id)}>{label}</button>)}
   </nav>
  </section>
  <aside className="scroll-thin min-h-0 space-y-4 overflow-y-auto border-l border-[#d5dbce] bg-[#f6f3e9] p-4">
   <div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#738275]">Your partnership with the town</div><h2 className="mt-1 font-serif text-2xl text-[#315244]">Council & community</h2>{snapshot&&<p className="mt-2 text-xs text-[#627060]">You’re viewing a memory. Council figures and investments below apply to today’s village.</p>}</div>
   <details className="rounded-xl border border-[#d9ded1] p-3"><summary className="cursor-pointer font-serif text-lg text-[#355744]">Village scrapbook · {game.town.scrapbook.length} memories</summary><p className="my-2 text-xs text-[#627060]">Revisit the village as it was at each opening, then compare it with today.</p><div className="flex flex-wrap gap-2"><button className="btn text-xs" aria-pressed={memory===null} onClick={()=>setMemory(null)}>Today</button>{game.town.scrapbook.map((m,i)=><button key={i} aria-pressed={memory===i} className="rounded border border-[#c6d0bb] p-2 text-left text-xs text-[#49614d]" onClick={()=>{setMemory(i);setCelebrating(false)}}>{m.label}<small className="block">Winter {m.season} · Day {m.day}</small></button>)}</div></details>
   <div className="grid grid-cols-2 gap-2">
    <Metric label="Visitor beds" value={String(benefits.beds)}/><Metric label="Shuttle capacity" value={`+${benefits.transport}`}/>
    <Metric label="Staff cost relief" value={`${Math.round(benefits.payrollDiscount*1000)/10}%`}/><Metric label="Daily commitments" value={formatMoney(benefits.dailyCost)}/>
   </div>
   {construction&&<div className="rounded-xl border border-[#d6bc79] bg-[#fff3d4] p-3">
    <div className="flex justify-between text-xs font-semibold text-[#756039]"><span>{TOWN_PROJECTS[construction.project].name}</span><span>{construction.remainingDays} days left</span></div>
    <div className="my-2 h-2 overflow-hidden rounded bg-[#e4d7b4]"><div className="h-full rounded bg-[#b2904c] transition-all" style={{width:`${(1-construction.remainingDays/construction.totalDays)*100}%`}}/></div>
    <p className="text-[11px] text-[#7b7054]">Construction advances after each operating day. Your approved building will appear here when it opens.</p>
   </div>}
   <div className="grid grid-cols-2 gap-2" role="group" aria-label="Town investment">
    {TOWN_PROJECT_ORDER.map(id=><button key={id} aria-pressed={project===id} onClick={()=>{setProject(id);setHomes(false)}} className={`rounded-xl border p-3 text-left ${project===id?'border-[#527766] bg-[#e5ebdf]':'border-[#dedfd3] bg-white/40'}`}><span className="block text-xs font-semibold text-[#3f5d4d]">{TOWN_PROJECTS[id].name}</span><span className="mt-1 block text-[10px] text-[#7d8673]">{'●'.repeat(game.town.levels[id])}{'○'.repeat(TOWN_MAX_LEVEL-game.town.levels[id])} · Level {game.town.levels[id]}</span></button>)}
   </div>
   <section className="space-y-3 border-t border-[#d9ded1] pt-3">
    <div className="flex items-center justify-between"><h3 className="font-serif text-xl text-[#355744]">{spec.name}</h3><span className="text-xs text-[#6c7d69]">{proposal.maxed?'Complete':`Next: level ${game.town.levels[project]+1}`}</span></div>
    <p className="text-xs leading-relaxed text-[#627060]">{spec.benefit}</p>
    {project==='inn'&&!proposal.maxed&&<label className="flex items-start gap-2 rounded-lg bg-[#e8ecde] p-2 text-xs text-[#526a54]"><input type="checkbox" checked={homes} onChange={e=>setHomes(e.target.checked)} className="mt-1"/><span>Include employee homes · +{formatMoney(TOWN_HOMES_COMPACT_COST)}<small className="mt-1 block">A visible staff lodge, 2% additional payroll relief, and stronger resident support.</small></span></label>}
    {!proposal.maxed&&<>
     <div className="space-y-2">
      {proposal.votes.map(v=><div key={v.seat} className="rounded-lg bg-white/55 p-2"><div className="flex items-center justify-between gap-2 text-[11px]"><span className="font-medium text-[#4f6455]">{TOWN_SEAT_LABELS[v.seat]}</span><span className={v.yes?'font-bold text-[#477954]':'font-bold text-[#a06e42]'}>{v.yes?'Supports':'Opposes'}</span></div><div className="mt-1 text-[10px] text-[#7e8978]">Relationship {game.town.trust[v.seat]}/100 · Proposal support {v.score}/100</div></div>)}
     </div>
     <p className="text-[11px] text-[#6f7967]">Two votes required. Completed public projects build relationships. Housing and transit make future inn proposals easier to approve.</p>
     <button className="btn btn-primary w-full" disabled={game.phase!=='planning'||!!construction||!proposal.approved||game.cash<proposal.cost} onClick={()=>propose(project,homes)}>Propose & fund · {formatMoney(proposal.cost)}</button>
     <p className="text-center text-[11px] text-[#78816e]">{construction?'One town project at a time.':game.phase!=='planning'?'Council meets during morning planning.':!proposal.approved?'Revise the plan or build community support first.':game.cash<proposal.cost?'More company cash is needed.':`Council approves · Opens in ${proposal.days} operating days`}</p>
    </>}
   </section>
   <section className="space-y-3 border-t border-[#d9ded1] pt-3"><h3 className="font-serif text-xl text-[#355744]">Town charters</h3>{(Object.keys(TOWN_POLICIES) as TownPolicy[]).map(policy=>{
    const vote=townPolicyProposal(game,policy), spec=TOWN_POLICIES[policy]
    const adopted=game.town.policies[policy], needsStreet=policy==='winterMarket'&&game.town.levels.mainstreet===0
    return <div key={policy} className="space-y-2 rounded-lg bg-white/50 p-3"><h4 className="text-sm font-semibold text-[#49614d]">{spec.name}</h4><p className="text-xs text-[#627060]">{spec.benefit}</p><p className="text-[11px] text-[#627060]">{vote.votes.map(v=>`${TOWN_SEAT_LABELS[v.seat]}: ${v.yes?'supports':'opposes'}`).join(' · ')}</p><button className="btn w-full text-xs" disabled={adopted||needsStreet||game.phase!=='planning'||!vote.approved||game.cash<vote.cost} onClick={()=>adopt(policy)}>{adopted?'Charter adopted':`Adopt · ${formatMoney(vote.cost)}`}</button>{!adopted&&<p className="text-[11px] text-[#627060]">{needsStreet?'Renew Main Street first.':game.phase!=='planning'?'Council meets during morning planning.':!vote.approved?'Two votes required.':game.cash<vote.cost?'More company cash is needed.':'Permanent charter · takes effect immediately.'}</p>}</div>
   })}</section>
  </aside>
 </div>
}
function Metric({label,value}:{label:string;value:string}) {return <div className="rounded-lg bg-[#e9eddf] px-3 py-2"><div className="font-serif text-xl text-[#3e5e4d]">{value}</div><div className="text-[10px] text-[#7a8672]">{label}</div></div>}
