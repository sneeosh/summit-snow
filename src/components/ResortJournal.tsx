import { ResortWorkshop, HostedEvents, PostcardStudio } from './ResortWorkshop'
import { useEffect, useRef, useState } from 'react'
import { morningBriefing } from '../game/briefing'
import { VISIT_GOALS, VISIT_ORIGINS, activityLabel } from '../game/visits'
import type { GuestVisit } from '../game/types'
import { formatClock, formatMoney, useStore } from '../state/store'

export function VisitStory({ visit }: { visit: GuestVisit }) {
  return <div className="space-y-3 text-sm">
    <p className="rounded-xl bg-pine/10 p-3"><strong>{visit.fulfilled ? '⭐ Goal achieved' : '🎿 Today’s goal'}</strong><br/>{VISIT_GOALS[visit.goal]}<br/><small>Arrived from: {VISIT_ORIGINS[visit.origin]}</small></p>
    {!!visit.notes?.length && <div><h4 className="font-semibold">What stood out</h4><ul className="mt-1 space-y-1">{visit.notes.map((n,i)=><li key={i}>{n.delta<0?'⚠️':'💚'} {n.text}</li>)}</ul></div>}
    <ol className="space-y-2 border-l-2 border-pine/20 pl-3">{visit.steps.map((s,i)=><li key={i}><time className="mr-2 text-xs text-ink-faint">{formatClock(s.minute)}</time>{s.label}</li>)}</ol>
  </div>
}

export function ResortJournal() {
  const game = useStore(s=>s.game)!
  const [open,setOpen] = useState(false)
  const [tab,setTab] = useState<'briefing'|'visits'|'workshop'|'events'|'postcards'>('briefing')
  const [chosen,setChosen] = useState<number|null>(null)
  const ref=useRef<HTMLDialogElement>(null)
  useEffect(()=>{ if(open) ref.current?.showModal(); else ref.current?.close() },[open])
  const brief=morningBriefing(game)
  const guests=Object.values(game.guests)
  const live=chosen===null?undefined:game.guests[chosen]
  const past=game.recentVisits?.find(v=>v.id===chosen)
  const visit=live?.visit??past?.visit
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
      <header className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-ink-faint">Winter {game.season} · Day {game.day}</p><h2 className="font-display text-3xl">Resort journal</h2></div><button className="btn" aria-label="Close resort journal" onClick={()=>setOpen(false)}>Close</button></header>
      <nav className="my-4 flex flex-wrap gap-2" aria-label="Journal sections">{(['briefing','visits','workshop','events','postcards'] as const).map(t=><button className={`btn ${tab===t?'btn-primary':'btn-ghost'}`} aria-pressed={tab===t} key={t} onClick={()=>setTab(t)}>{{briefing:'☀️ Morning briefing',visits:'🎿 Guest stories',workshop:'🎨 Customize',events:'🎉 Events',postcards:'📷 Postcards'}[t]}</button>)}</nav>
      {tab==='workshop'?<ResortWorkshop/>:tab==='events'?<HostedEvents/>:tab==='postcards'?<PostcardStudio/>:tab==='briefing'?<div className="space-y-4">
        <p className="rounded-xl bg-pine/10 p-4 text-lg">About <strong>{brief.demand}</strong> visitors expected today.<small className="mt-1 block text-sm">{brief.yesterday?`Yesterday: ${brief.yesterday.guestsServed} guests · ${Math.round(brief.yesterday.avgSatisfaction)}% satisfaction · ${formatMoney(brief.yesterday.netProfit)} net`:'Your first day starts here. Cover the basics, then open the resort.'}</small></p>
        {brief.tips.map(t=><article className="rounded-xl border border-ink/10 p-4" key={t.title}><h3 className="font-semibold">{t.title}</h3><p className="my-2 text-sm text-ink-soft">{t.detail}</p><button className="btn btn-ghost" onClick={()=>navigate(t.action)}>Review {t.action}</button></article>)}
        <p className="text-sm text-ink-soft">🏘️ Village connections: {brief.benefits.beds} beds · {brief.benefits.transport} shuttle capacity · {Math.round(brief.benefits.payrollDiscount*1000)/10}% payroll relief.</p>
      </div>:<div className="journal-visits">
        <div className="space-y-2"><p className="text-sm text-ink-soft">Follow a live visitor or revisit one of the latest 24 departures today.</p>{!guests.length&&!game.recentVisits?.length&&<p className="rounded-xl bg-pine/10 p-4">Open the resort to meet your first guests.</p>}
          {guests.slice(0,80).map(g=><button key={g.id} onClick={()=>setChosen(g.id)} aria-pressed={chosen===g.id} className={`w-full rounded-lg border p-2 text-left text-sm ${chosen===g.id?'border-pine bg-pine/10':'border-ink/10'}`}><strong>{g.name}</strong><small className="block">{activityLabel(game,g)} · {Math.round(g.satisfaction)}%</small></button>)}
          {guests.length>80&&<p className="text-xs">Showing the first 80 guests; others can be selected on the mountain.</p>}
          {[...(game.recentVisits??[])].reverse().map(g=><button key={g.id} onClick={()=>setChosen(g.id)} className="w-full rounded-lg border border-ink/10 p-2 text-left text-sm">{g.name}<small className="block">Departed · {Math.round(g.satisfaction)}%</small></button>)}
        </div><section>{visit?<><h3 className="mb-3 font-display text-2xl">{live?.name??past?.name}</h3><VisitStory visit={visit}/>{live&&<button className="btn mt-3" onClick={()=>{setOpen(false);useStore.getState().setWorldView('mountain');useStore.getState().select({type:'guest',id:live.id})}}>Show guest on mountain</button>}</>:<p className="p-4 text-ink-soft">Choose a visitor to read their story.</p>}</section>
      </div>}
    </dialog>
  </>
}
