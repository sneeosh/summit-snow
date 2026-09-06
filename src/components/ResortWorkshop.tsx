import { useRef, useState } from 'react'
import { HOSTED_EVENTS, RESORT_COLORS, eventReadiness, makePostcard, todayHostedEvent } from '../game/creativity'
import { getLiftSite, getTrailDef } from '../game/trails'
import type { HostedEventKind } from '../game/types'
import { formatMoney, useStore } from '../state/store'
import { TownScene } from './TownScene'

export function ResortWorkshop() {
  const game=useStore(s=>s.game)!
  const update=useStore(s=>s.updateStyle)
  const rename=useStore(s=>s.renameRoute)
  const [name,setName]=useState(game.style.name)
  const [route,setRoute]=useState('')
  const [routeName,setRouteName]=useState('')
  const [saved,setSaved]=useState(false)
  const routes=[...Object.keys(game.lifts).map(id=>({key:`lift:${id}`,name:getLiftSite(game,id).name})),...Object.values(game.trails).filter(t=>t.built).map(t=>({key:`trail:${t.trailId}`,name:getTrailDef(game,t.trailId).name}))]
  return <div className="space-y-5">
    <p className="text-sm text-ink-soft">Make the resort your own. These cosmetic changes are free and saved with your season.</p>
    <form className="space-y-2" onSubmit={e=>{e.preventDefault();update({name});setSaved(true)}}><label className="block text-sm font-semibold" htmlFor="resort-name">Resort name</label><div className="flex flex-wrap gap-2"><input id="resort-name" className="workshop-input min-w-0 flex-1" value={name} maxLength={32} placeholder="Use the mountain’s name" onChange={e=>{setName(e.target.value);setSaved(false)}}/><button className="btn btn-primary" type="submit">Apply name</button></div>{saved&&<p role="status" className="text-sm text-pine">Name applied. Use Save game to keep your changes.</p>}</form>
    <fieldset><legend className="mb-2 text-sm font-semibold">Village accent color</legend><div className="flex flex-wrap gap-2">{RESORT_COLORS.map((color,i)=><button key={color} className="h-10 w-10 rounded-full border-4" style={{background:color,borderColor:game.style.color===color?'#192c30':'transparent'}} aria-label={['Pine green','Brick red','Lake blue','Golden timber','Heather purple'][i]} aria-pressed={game.style.color===color} onClick={()=>update({color})}/>)}</div></fieldset>
    <fieldset><legend className="mb-2 text-sm font-semibold">Village decorations</legend><div className="flex flex-wrap gap-2">{(['natural','lanterns','bunting'] as const).map(decor=><button key={decor} className={`btn ${game.style.decor===decor?'btn-primary':'btn-ghost'}`} aria-pressed={game.style.decor===decor} onClick={()=>update({decor})}>{decor==='natural'?'🌲 Natural':decor==='lanterns'?'🏮 Lanterns':'🚩 Bunting'}</button>)}</div></fieldset>
    <div className="h-52 overflow-hidden rounded-xl border border-ink/10"><TownScene game={game} still/></div>
    <form className="space-y-2 border-t border-ink/10 pt-4" onSubmit={e=>{e.preventDefault();const split=route.indexOf(':');rename(route.slice(0,split) as 'trail'|'lift',route.slice(split+1),routeName);setRouteName('')}}><label className="block text-sm font-semibold" htmlFor="route-choice">Name a built lift or trail</label><select id="route-choice" className="workshop-input w-full" value={route} onChange={e=>setRoute(e.target.value)}><option value="">Choose a lift or trail</option>{routes.map(r=><option key={r.key} value={r.key}>{r.name}</option>)}</select><div className="flex flex-wrap gap-2"><input className="workshop-input min-w-0 flex-1" aria-label="New lift or trail name" maxLength={28} value={routeName} onChange={e=>setRouteName(e.target.value)}/><button className="btn btn-primary" disabled={!route||!routeName.trim()}>Rename</button></div></form>
  </div>
}

export function HostedEvents() {
  const game=useStore(s=>s.game)!
  const book=useStore(s=>s.bookHostedEvent)
  const today=todayHostedEvent(game)
  return <div className="space-y-4"><p className="text-sm text-ink-soft">Book one event before opening. The fee is charged immediately; successful events earn +0.1 reputation. Extra demand still depends on your resort and arrival capacity.</p>
    {today&&<p className="rounded-xl bg-pine/10 p-4"><strong>Today: {HOSTED_EVENTS[today.kind].name}</strong><br/>{today.status==='booked'?'Booked — open the resort, then check the day-end report.':`${today.status==='success'?'Goal achieved':'Goal missed'} · ${today.result}`}</p>}
    {(Object.keys(HOSTED_EVENTS) as HostedEventKind[]).map(kind=>{const spec=HOSTED_EVENTS[kind],reason=eventReadiness(game,kind);return <article className="space-y-2 rounded-xl border border-ink/10 p-4" key={kind}><h3 className="font-display text-xl">{spec.name}</h3><p className="text-sm">{spec.goal}</p><p className="text-sm text-ink-soft">Booking: {formatMoney(spec.cost)} · Up to {Math.round((spec.demand-1)*100)}% extra demand.</p><button className="btn btn-primary" disabled={!!reason} onClick={()=>book(kind)}>Book for today</button>{reason&&<p className="text-xs text-ink-faint">{reason}</p>}</article>})}
    <h3 className="font-display text-xl">Event memories</h3>{game.hostedEvents.filter(e=>e.status!=='booked').slice(-12).reverse().map(e=><p key={`${e.season}-${e.day}`} className="rounded-lg bg-white/60 p-3 text-sm">{e.status==='success'?'🏆':'❄️'} {HOSTED_EVENTS[e.kind].name} · Winter {e.season}, day {e.day}<small className="block">{e.result}</small></p>)}
  </div>
}

export function PostcardStudio() {
  const game=useStore(s=>s.game)!
  const [selected,setSelected]=useState(-1)
  const [status,setStatus]=useState('')
  const svgRef=useRef<SVGSVGElement>(null)
  const card=game.postcards[selected]??makePostcard(game)
  const shown={...game,minute:510,mountainId:card.mountainId,day:card.day,season:card.season,town:card.town,style:card.style}
  async function download() {
    if(!svgRef.current)return
    setStatus('Preparing your postcard…')
    const markup=new XMLSerializer().serializeToString(svgRef.current)
    const url=URL.createObjectURL(new Blob([markup],{type:'image/svg+xml;charset=utf-8'}))
    try {
      const image=new Image()
      await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Could not render postcard'));image.src=url})
      const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=820
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image export unavailable')
      ctx.drawImage(image,0,0)
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Image export failed')),'image/png'))
      const png=URL.createObjectURL(blob),link=document.createElement('a');link.href=png;link.download=`summit-snow-winter-${card.season}-day-${card.day}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(png),1000)
      setStatus('Postcard downloaded.')
    } catch {setStatus('Could not export the image. Please try again.')} finally {URL.revokeObjectURL(url)}
  }
  return <section className="space-y-3"><p className="text-sm text-ink-soft">A postcard from your resort today. Season-end postcards are kept automatically for the latest 12 winters.</p>
    <label className="block text-sm">Postcard<select className="workshop-input ml-2" value={selected} onChange={e=>setSelected(Number(e.target.value))}><option value={-1}>Today</option>{game.postcards.map((p,i)=><option key={i} value={i}>Winter {p.season} · Day {p.day}</option>)}</select></label>
    <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 820" width="1200" height="820" role="img" aria-label={`Postcard from ${card.name}`} style={{width:'100%',height:'auto',fontFamily:'Georgia, serif',background:'#f6f1df'}}>
      <style>{'.postcard-scene .town-car,.postcard-scene .town-walker,.postcard-scene .town-snowflake{display:none}.postcard-scene .town-art{width:100%;height:100%}'}</style>
      <rect width="1200" height="820" rx="20" fill="#f6f1df"/>
      <text x="50" y="66" textLength={card.name.length>24?1100:undefined} lengthAdjust="spacingAndGlyphs" fontSize="36" fill="#315347">Greetings from {card.name}</text><text x="50" y="101" fontSize="20" fill="#627768">SUMMIT &amp; SNOW · WINTER {card.season} · DAY {card.day}</text>
      <svg className="postcard-scene" x="40" y="125" width="1120" height="535" viewBox="0 0 1200 680"><TownScene game={shown} still/></svg>
      <text x="50" y="715" fontSize="28" fill="#315347">{card.guests.toLocaleString()} guests · {card.reputation.toFixed(1)} stars · {card.events} successful events</text>
      <text x="50" y="770" fontSize="21" fill="#627768">A mountain shaped by you. See you next winter.</text>
    </svg>
    <button className="btn btn-primary" onClick={download}>📷 Download postcard PNG</button><p role="status" className="text-sm">{status}</p>
  </section>
}
