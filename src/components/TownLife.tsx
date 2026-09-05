import type { CSSProperties } from 'react'

// Follow the same two quadratic curves as the painted main street.
function streetPoint(t: number, pavement = 0): [number, number] {
  const second = t > .5
  const u = second ? (t - .5) * 2 : t * 2
  const [a, b, c] = second ? [[505, 442], [735, 499], [1240, 401]] : [[-40, 490], [275, 385], [505, 442]]
  return [(1-u)**2*a[0]+2*(1-u)*u*b[0]+u*u*c[0], (1-u)**2*a[1]+2*(1-u)*u*b[1]+u*u*c[1]+pavement]
}

export function TownPedestrians({ count }: { count: number }) {
  return <g aria-label="People strolling along the village sidewalks" pointerEvents="none">
    {Array.from({ length: Math.ceil(count) }, (_, i) => {
      // Short, overlapping walks with pauses at either end, spread across town.
      const start = .16 + (i % 12) * .064
      const points = Array.from({ length: 6 }, (_, step) => streetPoint(start + step * .012, -33 - (i % 2) * 3))
      const path = points.map(([x,y], step) => `${step ? 'L' : 'M'}${x} ${y}`).join(' ')
      const color = ['#b65d4b', '#4d788b', '#bd9148', '#65816b', '#8f6886'][i % 5]
      return <g key={i} className="town-walker" style={{ offsetAnchor: '0px 6px', offsetPath: `path("${path}")`, offsetDistance: `${(i * 37) % 100}%`, animationDuration: `${28 + i % 5 * 5}s`, animationDelay: `${-i * 7}s` }}>
        <ellipse cy="5" rx="4" ry="2" fill="#748b8b" opacity=".3"/>
        <g className="town-walking-body" style={{ animationDelay: `${-i * .17}s` }}>
          <path d="M-2 1L-3 6M2 1L3 6" stroke="#485651" strokeWidth="2"/>
          <rect x="-3.5" y="-7" width="7" height="10" rx="2" fill={color}/>
          <path d="M-4-5L-5 0M4-5L5-1" stroke={color} strokeWidth="2"/>
          <circle cy="-9" r="3" fill="#dcb68e"/>
          <path d="M-3-11H3" stroke={color} strokeWidth="3"/>
          {i % 3 === 0 && <path d="M-3-6L3-6 5-2" fill="none" stroke="#eee2be" strokeWidth="1.5"/>}
        </g>
      </g>
    })}
  </g>
}

export function TownTraffic({ busy, dusk }: { busy: boolean; dusk: boolean }) {
  return <g aria-label="Cars travelling through the village" pointerEvents="none">
    {Array.from({ length: busy ? 6 : 4 }, (_, i) => {
      const reverse = i % 2 === 1
      const lane = reverse ? -11 : 11
      const path = `M-40 ${490+lane}Q275 ${385+lane} 505 ${442+lane}T1240 ${401+lane}`
      return <g key={i} className="town-car" style={{ offsetPath: `path("${path}")`, offsetDistance: `${12 + i * 15}%`, offsetRotate: reverse ? 'auto 180deg' : 'auto', animationDirection: reverse ? 'reverse' : 'normal', animationDuration: '48s', animationDelay: `${-i * 8 - 4}s` }}>
        <ellipse cy="2" rx="17" ry="8" fill="#526a6a" opacity=".2"/>
        {dusk && <path d="M15-4L48-13V13L15 4Z" fill="#fff0b7" opacity=".15"/>}
        <path d="M-10-6H-5M7-6H12M-10 6H-5M7 6H12" stroke="#414d4d" strokeWidth="3"/>
        <rect x="-16" y="-6" width="32" height="12" rx="4" fill={['#aa5748','#d4b571','#587c86','#64786b','#b7b6a7','#857091'][i]}/>
        <rect x="-8" y="-5" width="17" height="10" rx="3" fill="#b9d2d5"/>
        <rect x="-5" y="-5" width="9" height="10" rx="2" fill={i % 2 ? '#ded8c5' : '#e8ece4'}/>
        <path d="M14-4V-2M14 2V4" stroke="#ffedb7" strokeWidth="2"/>
        <path d="M-14-4V-2M-14 2V4" stroke="#a73e35" strokeWidth="2"/>
      </g>
    })}
  </g>
}

export function TownSnow({ snowfall, wind }: { snowfall: number; wind: number }) {
  if (snowfall <= 0) return null
  const count = Math.min(160, 55 + Math.ceil(snowfall * 9))
  return <g aria-label="Falling snow" pointerEvents="none">
    {Array.from({ length: count }, (_, i) => <circle key={i} className="town-snowflake" cx={(i * 197) % 1380 - 90} cy={-35} r={1.1 + (i % 4) * .5} fill="#ffffff" opacity={.4 + (i % 4) * .15} style={{ '--snow-drift': `${Math.min(160, wind * 2) + (i % 5) * 8}px`, animationDuration: `${12 + i % 9}s`, animationDelay: `${-(i * 3.71) % 21}s`, transform: `translate(0, ${(i * 79) % 760}px)` } as CSSProperties}/>)}
  </g>
}

/** Simulation-clock journeys: pause with the game and only use completed village projects. */
export function TownJourneys({ game }: { game: import('../game/types').GameState }) {
  const guests = Object.values(game.guests).filter(g=>g.visit && (g.objective==='leaving' || game.minute-g.arrivalMinute<16)).slice(0,12)
  const staff = game.town.levels.housing > 0 ? Math.min(6, game.staff.reduce((n,d)=>n+d.headcount,0)) : 0
  return <g aria-label="Journeys between the village and ski resort">
    {guests.map(g=>{
      const leaving=g.objective==='leaving'
      const progress=Math.min(1,Math.max(0,(game.minute-g.arrivalMinute)/16))
      const t=leaving?.82-((game.minute%16)/16)*.55:.27+progress*.55
      const [x,y]=streetPoint(t,-35)
      return <g key={g.id} transform={`translate(${x},${y-6})`}><title>{g.name} · {leaving?'Heading home':g.visit?.origin==='inn'?'Walking from the inn':g.visit?.origin==='shuttle'?'Arriving by shuttle':'Walking to the resort'}</title><path d="M-2 0L-3 6M2 0L3 6" stroke="#344f4c" strokeWidth="2"/><rect x="-4" y="-9" width="8" height="11" rx="2" fill={g.visit?.origin==='inn'?'#a56065':'#497c99'}/><circle cy="-12" r="3" fill="#dfb58d"/><path d="M5-14V7" stroke="#b38746" strokeWidth="2"/></g>
    })}
    {Array.from({length:staff},(_,i)=>{
      const homeward=game.minute>=960
      const t=.18+(homeward?1-Math.min(1,(game.minute-960)/35):Math.min(1,Math.max(0,(game.minute-510)/35)))*.6+i*.009
      const [x,y]=streetPoint(t,-40)
      return <g key={`staff-${i}`} transform={`translate(${x},${y-6})`}><title>{homeward?'Staff walking home':'Staff commute from employee housing'}</title><path d="M-2 0L-3 6M2 0L3 6" stroke="#344f4c" strokeWidth="2"/><rect x="-4" y="-9" width="8" height="11" rx="2" fill="#b7833f"/><circle cy="-12" r="3" fill="#dfb58d"/></g>
    })}
    {game.town.levels.shuttle>0&&game.phase==='operating'&&(()=>{const [x,y]=streetPoint((game.minute%30)/30,11);return <g transform={`translate(${x},${y})`}><title>Village shuttle service</title><rect x="-24" y="-8" width="48" height="16" rx="4" fill="#e7bb65"/><path d="M-16-5H15V5H-16Z" fill="#64878e"/><text textAnchor="middle" y="3" fontSize="7" fill="white">SHUTTLE</text></g>})()}
  </g>
}
