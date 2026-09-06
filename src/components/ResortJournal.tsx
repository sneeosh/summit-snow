import { useEffect, useRef, useState } from 'react'
import { morningBriefing } from '../game/briefing'
import { VISIT_GOALS, VISIT_ORIGINS, activityLabel } from '../game/visits'
import type { GuestVisit } from '../game/types'
import { formatClock, formatMoney, useStore } from '../state/store'

export function VisitStory({ visit }: { visit: GuestVisit }) {
  const [expanded,setExpanded] = useState(false)
  const steps = expanded || visit.steps.length <= 7 ? visit.steps : [visit.steps[0], ...visit.steps.slice(-6)]
  return <div className="space-y-3 text-sm">
    <p className="rounded-xl bg-pine/10 p-3"><strong>{visit.fulfilled ? '⭐ Goal achieved' : '🎿 Today’s goal'}</strong><br/>{VISIT_GOALS[visit.goal]}<br/><small>Arrived from: {VISIT_ORIGINS[visit.origin]}</small></p>
    {!!visit.notes?.length && <div><h4 className="font-semibold">What stood out</h4><ul className="mt-1 space-y-1">{visit.notes.map((n,i)=><li key={i}>{n.delta<0?'⚠️':'💚'} {n.text}</li>)}</ul></div>}
    {visit.steps.length>7&&<button className="btn btn-ghost" onClick={()=>setExpanded(!expanded)}>{expanded?'Show highlights':`Show retained timeline (${visit.steps.length} entries)`}</button>}
    <ol className="space-y-2 border-l-2 border-pine/20 pl-3">{steps.map((s,i)=><li key={i}><time className="mr-2 text-xs text-ink-faint">{formatClock(s.minute)}</time>{s.label}</li>)}</ol>
  </div>
}

export function ResortJournal() {
  const game = useStore(s=>s.game)!
  const [open,setOpen] = useState(false)
  const [tab,setTab] = useState<'briefing'|'visits'>('briefing')
  const [chosen,setChosen] = useState<number|null>(null)
  const [query,setQuery] = useState('')
  const [filter,setFilter] = useState('all')
  const speed = useStore(s=>s.speed)
  const ref=useRef<HTMLDialogElement>(null)
  useEffect(()=>{ if(open) ref.current?.showModal(); else ref.current?.close() },[open])
  const brief=morningBriefing(game)
  const guests=Object.values(game.guests)
  const live=chosen===null?undefined:game.guests[chosen]
  const past=game.recentVisits?.find(v=>v.id===chosen)
  const selected = useRef<{name:string;visit:GuestVisit}|null>(null)
  useEffect(()=>{ const g=live??past; if(g?.visit) selected.current={name:g.name,visit:structuredClone(g.visit)} },[game,live,past])
  useEffect(()=>{selected.current=null;setChosen(null)},[game.mountainId,game.season,game.day])
  const visit=live?.visit??past?.visit??selected.current?.visit
  const matches = (g:{name:string;satisfaction:number;visit?:GuestVisit}, departed=false) => g.name.toLowerCase().includes(query.toLowerCase()) && (filter==='all'||filter==='unhappy'&&g.satisfaction<60||filter==='goals'&&g.visit?.fulfilled||filter==='departed'&&departed)
  const filteredGuests = guests.filter(g=>matches(g))
  const filteredPast = [...(game.recentVisits??[])].reverse().filter(g=>matches(g,true))
  function navigate(action: string) {
    setOpen(false)
    const store=useStore.getState()
    store.setWorldView(action==='town'?'town':'mountain')
    if(action==='operations') store.setBottomTab('operations')
    else if(action!=='town') store.setLeftTab(action as 'staff'|'build'|'pricing')
  }
  return <>
    <button className="btn btn-ghost" onClick={()=>setOpen(true)}>📖 Resort journal</button>
    <dialog ref={ref} onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)} className="resort-dialog">
      <header className="journal-header flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-ink-faint">Winter {game.season} · Day {game.day}</p><h2 className="font-display text-3xl">Resort journal</h2></div><button className="btn" aria-label="Close resort journal" onClick={()=>setOpen(false)}>Close</button></header>
      <nav className="my-4 flex flex-wrap gap-2" aria-label="Journal sections">{(['briefing','visits'] as const).map(t=><button className={`btn ${tab===t?'btn-primary':'btn-ghost'}`} aria-pressed={tab===t} key={t} onClick={()=>setTab(t)}>{t==='briefing'?'☀️ Morning briefing':'🎿 Guest stories'}</button>)}</nav>
      {game.phase==='operating'&&<button className="btn mb-3" onClick={()=>useStore.getState().setSpeed(speed===0?1:0)}>{speed===0?'▶ Resume simulation':'⏸ Pause simulation'}</button>}
      {tab==='briefing'?<div className="space-y-4">
        <p className="rounded-xl bg-pine/10 p-4 text-lg">About <strong>{brief.demand}</strong> visitors expected today.<small className="mt-1 block text-sm">{brief.yesterday?`Yesterday: ${brief.yesterday.guestsServed} guests · ${Math.round(brief.yesterday.avgSatisfaction)}% satisfaction · ${formatMoney(brief.yesterday.netProfit)} net`:'Your first day starts here. Cover the basics, then open the resort.'}</small></p>
        {brief.tips.map(t=><article className="rounded-xl border border-ink/10 p-4" key={t.title}><h3 className="font-semibold">{t.title}</h3><p className="my-2 text-sm text-ink-soft">{t.detail}</p><button className="btn btn-ghost" onClick={()=>navigate(t.action)}>Review {t.action}</button></article>)}
        <p className="text-sm text-ink-soft">🏘️ Village connections: {brief.benefits.beds} beds · {brief.benefits.transport} shuttle capacity · {Math.round(brief.benefits.payrollDiscount*1000)/10}% payroll relief.</p>
      </div>:<div className="journal-visits">
        <div className="space-y-2"><p className="text-sm text-ink-soft">Follow today’s visitors or the latest 24 departures. Stories reset each morning.</p>{!guests.length&&!game.recentVisits?.length&&<p className="rounded-xl bg-pine/10 p-4">Open the resort to meet your first guests.</p>}
          <input aria-label="Search guests" placeholder="Search guests" className="w-full rounded-lg border p-2" value={query} onChange={e=>setQuery(e.target.value)}/>
          <select aria-label="Filter guests" className="w-full rounded-lg border p-2" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All guests</option><option value="unhappy">Unhappy (under 60%)</option><option value="goals">Goal achieved</option><option value="departed">Departed</option></select>
          {!filteredGuests.length&&!filteredPast.length&&(query||filter!=='all')&&<p>No guests match this search.</p>}
          {filteredGuests.map(g=><button key={g.id} onClick={()=>{selected.current=null;setChosen(g.id)}} aria-pressed={chosen===g.id} className={`w-full rounded-lg border p-2 text-left text-sm ${chosen===g.id?'border-pine bg-pine/10':'border-ink/10'}`}><strong>{g.name}</strong><small className="block">Visitor #{g.id} · {activityLabel(game,g)} · {Math.round(g.satisfaction)}%</small></button>)}
          {filteredPast.map(g=><button key={g.id} onClick={()=>{selected.current=null;setChosen(g.id)}} className="w-full rounded-lg border border-ink/10 p-2 text-left text-sm">{g.name}<small className="block">Visitor #{g.id} · Departed · {Math.round(g.satisfaction)}%</small></button>)}
        </div><section>{visit?<><h3 className="mb-3 font-display text-2xl">{live?.name??past?.name??selected.current?.name}</h3>{!live&&!past&&<p className="text-sm">Saved view of the selected story.</p>}<VisitStory key={chosen} visit={visit}/>{live&&<button className="btn mt-3" onClick={()=>{setOpen(false);useStore.getState().setWorldView('mountain');useStore.getState().select({type:'guest',id:live.id})}}>Show guest on mountain</button>}</>:<p className="p-4 text-ink-soft">Choose a visitor to read their story.</p>}</section>
      </div>}
    </dialog>
  </>
}
