import { WINTER, TRAIL_MIN_DEPTH_CM, FACILITIES } from '../content/balance'
import { demandExplanation, serviceCosts } from '../game/economy'
import { liftDiagnosis, mountainPortrait, winterAdvice } from '../game/winter'
import type { MountainPortrait } from '../game/winter'
import type { GameState } from '../game/types'
import { getTrailDef } from '../game/trails'
import { formatMoney, useStore } from '../state/store'

const COLORS:Record<string,string>={green:'#398365',blue:'#457fa6',black:'#344751','double-black':'#91648c'}
export function WinterPortrait({portrait,label}:{portrait:MountainPortrait;label:string}) {
  return <figure className="overflow-hidden rounded-2xl border border-ink/10 bg-[#e6eff1]">
    <svg viewBox="0 0 1920 1200" role="img" aria-label={`${label}: ${portrait.trails.length} runs and ${portrait.lifts.length} lifts`}>
      <rect width="1920" height="1200" fill="#e6eff1"/>
      <path d="M0 550 L340 100 540 340 930 30 1150 320 1430 140 1920 560V1200H0Z" fill="#d4e1e1"/>
      <path d="M0 900 Q700 760 1920 980V1200H0Z" fill="#bdcfca"/>
      {portrait.trails.map(t=><polyline key={t.id} points={t.points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={COLORS[t.difficulty]} strokeWidth="14" strokeLinecap="round"/>)}
      {portrait.lifts.map(l=><g key={l.id}><polyline points={l.points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#a36442" strokeWidth="8" strokeDasharray="16 10"/>{l.points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="15" fill="#a36442"/>)}</g>)}
    </svg>
    <figcaption className="bg-white/60 p-3 text-sm"><strong>{label} · Day {portrait.day}</strong><br/>{portrait.trails.length} runs · {portrait.lifts.length} lifts · {portrait.facilities} facilities · {portrait.town} village upgrades</figcaption>
  </figure>
}
export function WinterRecap({game}:{game:GameState}) {
  const w=game.winter, days=w.days
  const profit=days.reduce((n,d)=>n+d.profit,0)
  const guests=days.reduce((n,d)=>n+d.guests,0)
  const best=[...days].sort((a,b)=>b.satisfaction-a.satisfaction)[0]
  const busiest=[...days].sort((a,b)=>b.guests-a.guests)[0]
  return <section className="mt-4 space-y-4" aria-label="Winter story">
    <div><p className="text-xs uppercase tracking-widest text-ink-faint">Winter {game.season} · Your mountain, your choices</p><h3 className="font-display text-2xl">{game.day>=54?'The winter we built':'A mountain taking shape'}</h3></div>
    {w.opening&&<div className="grid grid-cols-2 gap-3"><WinterPortrait portrait={w.opening} label="When we began"/><WinterPortrait portrait={mountainPortrait(game)} label="Our mountain now"/></div>}
    <p className="text-xs text-ink-faint">Route diagrams show actual built geometry. Visit Town view for the village and its opening-day scrapbook.</p>
    <div className="grid grid-cols-2 gap-2 text-sm"><p className="rounded-xl bg-pine/10 p-3"><strong>{guests.toLocaleString()}</strong> recorded arrivals<br/><strong>{formatMoney(profit)}</strong> operating result</p><p className="rounded-xl bg-pine/10 p-3"><strong>{formatMoney(game.cash-(w.opening?.cash??game.cash))}</strong> cash change<br/>Includes construction and financing; differs from operating profit.</p></div>
    {!!days.length&&<p className="text-sm">Busiest: day {busiest.day}, {busiest.guests} guests. Best satisfaction: day {best.day}, {best.satisfaction}%. {w.setback?`The setback on day ${w.setback.day}: ${w.setback.reason}. ${w.setback.recoveredDay?`Recovered on day ${w.setback.recoveredDay}.`:'Recovery is still unfinished.'}`:'No qualifying setback recorded.'}</p>}
    {!!game.hostedEvents.length&&<ul className="text-sm">{game.hostedEvents.filter(e=>e.season===game.season).map(e=><li key={`${e.day}-${e.kind}`}>Day {e.day} · {e.kind} · {e.status} {e.result&&`— ${e.result}`}</li>)}</ul>}
    <ol className="space-y-2 border-l-2 border-pine/20 pl-3">{w.entries.slice(-12).map((e,i)=><li key={i} className="text-sm"><strong>Day {e.day} · {e.title}</strong><p className="text-ink-soft">{e.detail}</p></li>)}</ol>
    {game.gameOver&&<p className="rounded-xl bg-pine/10 p-3 text-sm">Next winter: {Object.values(game.winter.audiences).some(v=>v<.45)?'Try serving the guests who struggled this season. Compare their experience with your strongest audience below.':'Try a different balance of teaching terrain, challenging runs and village life. Your seed makes the weather repeatable.'} Seed {game.seed}.</p>}
    {w.opening&&w.opening.day>1&&<p className="text-xs">This journal began on day {w.opening.day}; earlier history has not been invented.</p>}
  </section>
}
export function WinterStory() {
  const game=useStore(s=>s.game)!
  const setAdmission=useStore(s=>s.setAdmission)
  const restore=useStore(s=>s.restoreThinRun)
  const demand=game.phase==='planning'?demandExplanation(game):game.winter.openingDemand
  const planning=game.phase==='planning'&&!game.gameOver
  const thin=Object.values(game.trails).filter(t=>t.built&&t.snowDepthCm<TRAIL_MIN_DEPTH_CM)
  return <div className="space-y-5">
    <p className="rounded-xl bg-pine/10 p-4 text-sm"><strong>{game.day<8?'Opening week':game.day<WINTER.finaleDay?'Finding our stride':'One last weekend'}</strong><br/>{winterAdvice(game)}</p>
    {planning&&game.day<=7&&!Object.values(game.facilities).includes('rental-shop')&&<section className="rounded-xl border border-pine/20 p-4"><h3 className="font-display text-xl">Give the first guests a good start</h3><p className="my-2 text-sm">Open the starter lift and set up staffed rentals. Adding a school gives learners a reason to return. Leave money for snow and daily wages.</p>{[false,true].map(lessons=>{const cost=FACILITIES['rental-shop'].buildCost+(lessons&&!Object.values(game.facilities).includes('ski-school')?FACILITIES['ski-school'].buildCost:0);return <button key={String(lessons)} disabled={game.cash<cost} className="btn btn-ghost m-1" onClick={()=>useStore.getState().prepareOpening(lessons)}>{lessons?'Rentals + teaching':'Rentals first'} · {formatMoney(cost)}</button>})}<p className="mt-2 text-xs">Rental crew: $240/day; two instructors add $320/day. Buildings also have upkeep. You can change staffing later.</p></section>}
    <section className="space-y-2"><h3 className="font-display text-xl">How many guests can we welcome?</h3>
      {demand&&<p className="text-sm">{demand.interested} interested · {demand.admitted} bookings · {demand.capacity} arrival spaces. Returning-audience effect: {Math.round((demand.returning-1)*100)}%. {game.phase!=='planning'&&'Forecast captured before opening.'}</p>}
      {demand&&<p className="text-xs text-ink-soft">Visitor-service forecast: {formatMoney(serviceCosts(game,demand.admitted).visitorServices)}/day before supplies. Fewer admissions reduce these costs; employee housing reduces the service rate.</p>}
      <div className="flex flex-wrap gap-2">{(['welcome','comfortable'] as const).map(p=><button key={p} disabled={!planning} aria-pressed={game.winter.admission===p} className={`btn ${game.winter.admission===p?'btn-primary':'btn-ghost'}`} onClick={()=>setAdmission(p)}>{p==='welcome'?'Welcome up to capacity':'Comfortable · 70% capacity'}</button>)}</div>
      <p className="text-xs text-ink-soft">Lower admissions only help if crowds strain the mountain. They do not award satisfaction; guests still judge actual runs, queues and services.</p>
      <p className="text-xs text-ink-soft">If interested visitors exceed physical arrival capacity, repeated unmet demand reduces resident support for new inns. Close this journal and open Town view to compare shuttle and housing proposals.</p>
    </section>
    {!!thin.length&&<section className="rounded-xl border border-amber/30 p-3"><h3 className="font-semibold">A way back onto the snow</h3><p className="my-2 text-sm">Haul stored snow onto one thin run for {formatMoney(WINTER.recoveryCost)}. Adds {WINTER.recoveryDepth} cm, then use Reopen below after reviewing conditions. This is a short-term bridge; warmth can melt it again. Snowmaking is the lasting investment.</p>{thin.map(t=><button disabled={!planning||game.cash<WINTER.recoveryCost||game.winter.entries.some(e=>e.day===game.day&&e.title==='Emergency resurfacing')} key={t.trailId} className="btn btn-ghost m-1" onClick={()=>restore(t.trailId)}>Resurface {getTrailDef(game,t.trailId).name} · {Math.round(t.snowDepthCm)} cm</button>)}</section>}
    {Object.values(game.trails).some(t=>t.built&&!t.open&&t.snowDepthCm>=TRAIL_MIN_DEPTH_CM)&&<section className="rounded-xl border border-pine/20 p-3"><h3 className="font-semibold">Covered, but still closed</h3><p className="my-2 text-sm">Reopening is your choice. Avalanche holds still require morning control; this button never overrides them.</p>{Object.values(game.trails).filter(t=>t.built&&!t.open&&t.snowDepthCm>=TRAIL_MIN_DEPTH_CM).map(t=><button disabled={!planning} className="btn btn-ghost m-1" key={t.trailId} onClick={()=>useStore.getState().setTrailOpen(t.trailId,true)}>Reopen {getTrailDef(game,t.trailId).name} · {Math.round(t.snowDepthCm)} cm</button>)}</section>}
    <section><h3 className="font-display text-xl">Who wants to return?</h3><p className="text-xs text-ink-soft">Recent satisfaction by ability shifts future visitor mix. A neutral audience begins at 50%; at least five departures are needed to update a group.</p><div className="mt-2 grid grid-cols-2 gap-2">{Object.entries(game.winter.audiences).map(([skill,v])=><div key={skill} className="rounded-lg bg-ink/4 p-2 text-sm">{skill}: {Math.round(v*100)}%<progress aria-label={`${skill} returning audience`} className="block w-full accent-[#507066]" max={1} value={v}/></div>)}</div></section>
    <section><h3 className="font-display text-xl">Where are the queues?</h3>{liftDiagnosis(game).map(l=><article key={l.id} className="mt-2 rounded-xl border border-ink/10 p-3 text-sm"><strong>{l.name}</strong> · {l.queue} waiting · {l.rides} rides today<p>{l.detail}</p></article>)}</section>
    <WinterRecap game={game}/>
  </div>
}
