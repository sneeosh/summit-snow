import { createContext, useContext, useId } from 'react'
import { TownLandmark } from './TownLandmark'
import { TOWN_IDENTITIES } from '../content/town'
import type { GameState, TownProject } from '../game/types'
import { TOWN_PROJECTS } from '../content/town'
import { MOUNTAIN_MAP } from '../content/mountains'

export type TownCamera = 'panorama' | 'mainstreet' | 'riverside' | 'station'
const CAMERAS: Record<TownCamera, string> = { panorama: '0 0 1200 680', mainstreet: '290 210 640 410', riverside: '0 230 640 410', station: '560 220 640 410' }
const LOTS: Record<TownProject, [number, number]> = { housing: [240, 375], mainstreet: [490, 355], inn: [850, 315], shuttle: [820, 510] }
const COLORS: Record<string, string> = { prairie: '#a95746', granite: '#925443', alder: '#507066', yuki: '#906f59', kea: '#7b8471', elk: '#b7844e', wasatch: '#858b98', blanche: '#758da0' }

const Architecture = createContext('timber')

/** Authored town tableau. Projects occupy fixed lots; players never place individual buildings. */
export function TownScene({ game, camera = 'panorama', celebrating = false, still = false }: { game: GameState; camera?: TownCamera; celebrating?: boolean; still?: boolean }) {
 const uid = useId().replace(/:/g, '')
 const identity = TOWN_IDENTITIES[game.mountainId] ?? TOWN_IDENTITIES.alder
 const dusk = game.minute >= 16*60
 const attendance = game.phase === 'operating' ? Math.min(16, Math.ceil(Object.keys(game.guests).length/12)) : 0
 const people = Math.min(28, 4 + totalLevels(game)*.5 + attendance)
 const darkSky = game.town.policies.darkSky
 const levels = game.town.levels, total = Object.values(levels).reduce((a,b)=>a+b,0)
 const accent = COLORS[game.mountainId] ?? '#826856'
 const fresh = game.town.lastOpening?.day === game.day && game.town.lastOpening?.season === game.season ? game.town.lastOpening.project : null
 const winter = game.mountainId !== 'prairie'
 return <Architecture.Provider value={identity.roof}><svg data-dusk={dusk} data-dark-sky={darkSky} xmlns="http://www.w3.org/2000/svg" viewBox={CAMERAS[camera]} role="img" aria-label={`${MOUNTAIN_MAP[game.mountainId].name} town, ${total} completed district upgrades`} className={`h-full w-full town-art ${still?'town-still':''}`} preserveAspectRatio="xMidYMid slice">
  <defs>
   <linearGradient id={`${uid}-sky`} x2="0" y2="1"><stop stopColor="#a8c7d1"/><stop offset=".72" stopColor="#e6ddd0"/><stop offset="1" stopColor="#f5e7ce"/></linearGradient>
   <linearGradient id={`${uid}-snow`} x2=".5" y2="1"><stop stopColor="#edf0e7"/><stop offset="1" stopColor="#c5d4d5"/></linearGradient>
   <linearGradient id={`${uid}-river`} x2="1" y2=".6"><stop stopColor="#769ca5"/><stop offset="1" stopColor="#b7d1d1"/></linearGradient>
   <pattern id={`${uid}-paving`} width="16" height="10" patternUnits="userSpaceOnUse"><rect width="16" height="10" fill="#c6c4b6"/><path d="M0 0H16M0 0V10M8 0V5M0 5H16" stroke="#b4b4a7" strokeWidth=".6"/></pattern>
  </defs>
  <rect width="1200" height="680" fill={`url(#${uid}-sky)`}/>
  <circle cx="1000" cy="102" r="38" fill="#fff0c8" opacity=".75"/>
  <path d={winter ? 'M-50 265L95 148 170 179 320 56 430 150 515 91 680 201 820 58 960 166 1060 112 1250 280Z' : 'M-50 225Q180 125 350 200T680 181 1250 236Z'} fill="#a1b6bd"/>
  {winter && <path d="M260 108L320 56 377 112 337 99 318 114 304 95ZM757 118L820 58 891 122 849 108 826 128 806 98Z" fill="#e4e7e0"/>}
  <path d="M-20 280L180 207 335 277 490 168 697 275 894 186 1220 279V430H-20Z" fill="#7d9c9e"/>
  {Array.from({length:42},(_,i)=><Pine key={i} x={i*32-30} y={285+Math.sin(i*.63)*23} size={.75+(i%4)*.11} color="#587c76"/>)}
  <path d="M0 318Q300 255 570 320T1200 288V680H0Z" fill={`url(#${uid}-snow)`}/>
  <path d="M80 300C30 420 225 471 120 690" fill="none" stroke="#f6f4e9" strokeWidth="73"/>
  <path d="M80 300C30 420 225 471 120 690" fill="none" stroke="url(#town-river)" strokeWidth="47"/>
  <path d="M74 324Q63 367 82 383M111 471Q155 499 157 524M150 575L138 608" fill="none" stroke="#e0eeea" strokeWidth="2" opacity=".7"/>
  <path d="M-40 490Q275 385 505 442T1240 401" fill="none" stroke="#f7f6ec" strokeWidth="76"/>
  <path d="M-40 490Q275 385 505 442T1240 401" fill="none" stroke="#a4aaa6" strokeWidth="49"/>
  <path d="M-40 490Q275 385 505 442T1240 401" fill="none" stroke="#d6d7ca" strokeWidth="2" strokeDasharray="15 22"/>
  <path d="M870 425Q785 469 650 680" fill="none" stroke="#eeeede" strokeWidth="55"/>
  <path d="M870 425Q785 469 650 680" fill="none" stroke="#a4aaa6" strokeWidth="32"/>
  <g transform="translate(129 451) rotate(-17)"><rect x="-42" y="-25" width="84" height="48" fill="#b6a48c"/>{[-25,23].map(y=><path key={y} d={`M-46 ${y}H46`} stroke="#6d6a58" strokeWidth="5"/>)}{[-36,-12,12,36].map(x=><path key={x} d={`M${x} -28V-12M${x} 25V9`} stroke="#686653" strokeWidth="3"/>)}</g>
  <TownLandmark mountainId={game.mountainId} active={people>5}/>
  <Chalet x={440} y={280} width={70} floors={1} color="#b2a58d" sign="TOWN HALL"/>
  <Chalet x={605} y={340} width={76} floors={1} color={accent} sign="PROVISIONS"/>
  <Chalet x={1055} y={368} width={75} floors={1} color="#b69a75" sign="SKI & REPAIR"/>
  <Chalet x={355} y={520} width={85} floors={1} color="#9b7966" sign="THE OLD BAKERY"/>
  {levels.housing>0 && <g className={fresh==='housing'?'town-new-landmark':undefined}>
   <Chalet x={205} y={355} width={63} floors={levels.housing>1?2:1} color="#b6a07d"/>
   <Chalet x={294} y={385} width={66} floors={1} color={accent}/>
   {levels.housing>1&&<Chalet x={210} y={540} width={57} floors={1} color="#8d9a8b"/>}
   {levels.housing>2&&<Chalet x={262} y={600} width={72} floors={2} color="#ae8068"/>}
   <path d="M171 405H330M180 395V412M213 395V412M246 395V412M279 395V412M312 395V412" stroke="#978972" strokeWidth="3"/>
  </g>}
  {levels.mainstreet>0 && <g className={fresh==='mainstreet'?'town-new-landmark':undefined}>
   <path d="M375 367L556 376 584 420 365 405Z" fill={`url(#${uid}-paving)`} stroke="#e9e5d4" strokeWidth="6"/>
   <Chalet x={493} y={361} width={80} floors={levels.mainstreet>2?2:1} color="#ad725e" sign={levels.mainstreet>1?'MARKET HALL':'COFFEE & COCOA'}/>
   {levels.mainstreet>1&&<><MarketStall x={389} y={390} color="#a65849"/><MarketStall x={554} y={406} color="#52756b"/></>}
   {levels.mainstreet>2&&<g><path d="M348 340Q465 399 584 358" fill="none" stroke="#786c53"/>{Array.from({length:12},(_,i)=><path key={i} d={`M${350+i*20} ${346+Math.sin(i/11*Math.PI)*27}l8 14 7-10Z`} fill={i%2?'#c99b51':'#9f5447'}/>)}</g>}
  </g>}
  {levels.inn>0 && <g className={fresh==='inn'?'town-new-landmark':undefined}>
   {levels.inn>1&&<Chalet x={926} y={338} width={85} floors={2} color="#bcac8d"/>}
   <Chalet x={820} y={331} width={120} floors={levels.inn>1?3:2} color={accent} sign={levels.inn>2?'THE GRAND ALPINE':'VILLAGE INN'}/>
   {levels.inn>2&&<Chalet x={737} y={359} width={66} floors={2} color="#c9b38f"/>}
   <path d="M775 351L740 388 901 395 916 360" fill="#d0c5ae" stroke="#f4efdf" strokeWidth="5"/>
   {game.town.compactHomes>0&&<Chalet x={957} y={285} width={58} floors={1} color="#839185" sign="STAFF HOMES"/>}
  </g>}
  {levels.shuttle>0&&<g className={fresh==='shuttle'?'town-new-landmark':undefined}>
   <path d="M839 452L1000 454 986 533 796 530Z" fill={`url(#${uid}-paving)`} stroke="#e4e0ce" strokeWidth="5"/>
   <Chalet x={926} y={504} width={levels.shuttle>1?96:57} floors={1} color="#738f87" sign={levels.shuttle>2?'TRANSIT HALL':'SHUTTLE'}/>
   <g className={game.phase==='operating'&&attendance>0?'town-shuttle-arrival':undefined}><Bus x={829} y={510}/></g>{levels.shuttle>1&&<Bus x={849} y={565}/>}
   {levels.shuttle>2&&<><Pine x={1002} y={530} size={.9}/><path d="M797 480H871M809 480V456M861 480V456M799 456H871" stroke="#7a8177" strokeWidth="5"/></>}
  </g>}
  {game.town.construction&&<Construction project={game.town.construction.project} progress={1-game.town.construction.remainingDays/game.town.construction.totalDays}/>}
  {Object.entries(LOTS).filter(([project])=>levels[project as TownProject]===0&&game.town.construction?.project!==project).map(([project,[x,y]])=><g key={project} opacity=".65"><ellipse cx={x} cy={y+15} rx="44" ry="12" fill="#dce3dc"/><path d={`M${x} ${y+25}v-20`} stroke="#938774" strokeWidth="3"/><rect x={x-25} y={y-4} width="50" height="15" rx="2" fill="#e5d9bd"/><text x={x} y={y+7} textAnchor="middle" fontSize="6" fill="#675e4f">FUTURE {project==='inn'?'INN':project==='housing'?'HOMES':project==='shuttle'?'STATION':'SQUARE'}</text></g>)}
  {[ [50,565,1.7],[1095,590,1.7],[1160,560,1.4],[1130,405,.8],[324,304,.8],[53,338,.8],[540,611,1.2],[730,583,.8] ].map(([x,y,size],i)=><Pine key={i} x={x} y={y} size={size}/>)}
  {Array.from({length:Math.ceil(people)},(_,i)=>{
    // Follow the north pavement; no crowd sprites on rooftops or the bus apron.
    const second = i >= 10, t = second ? .025 + (i-10)*.05 : .48 + i*.045
    const [a,b,c] = second ? [[505,442],[735,499],[1240,401]] : [[-40,490],[275,385],[505,442]]
    const x=(1-t)**2*a[0]+2*(1-t)*t*b[0]+t*t*c[0]
    const y=(1-t)**2*a[1]+2*(1-t)*t*b[1]+t*t*c[1]-33
    return <Person key={i} x={x} y={y} color={['#a85743','#557c85','#b08f54'][i%3]}/>
  })}
  {game.town.policies.winterMarket&&<g aria-label="Chartered winter market"><MarketStall x={620} y={388} color="#ac5f52"/><MarketStall x={679} y={399} color="#657d65"/><path d="M595 350Q652 380 709 363" fill="none" stroke="#887457"/>{[600,620,640,660,680,700].map(x=><circle key={x} cx={x} cy={354+Math.sin((x-600)/100*Math.PI)*15} r="3" fill="#f7ce7c"/>)}</g>}
  {celebrating&&fresh&&<g className="town-celebration" aria-label="Opening ribbon ceremony" transform={`translate(${LOTS[fresh][0]} ${LOTS[fresh][1]+42})`}><path d="M-42 0H42" stroke="#bf534a" strokeWidth="5"/><path d="M-42-8V12M42-8V12" stroke="#827658" strokeWidth="3"/>{[-30,-12,12,30].map((x,i)=><Person key={x} x={x} y={16} color={i%2?'#536f83':'#ae724f'}/>)}{Array.from({length:16},(_,i)=><rect key={i} x={-55+i*7} y={-48-(i%4)*7} width="3" height="5" fill={i%2?'#d3ab55':'#b96a5b'}/>)}</g>}
  {dusk&&<rect width="1200" height="680" fill="#253751" opacity={darkSky?'.30':'.19'} pointerEvents="none"/>}
  {total>0&&[300,570,718,1030].map(x=><Lamp key={x} x={x} y={440+Math.sin(x)*12}/>)}
  <g transform="translate(35 651)"><path d="M0 45V-13M3 -5H205" stroke="#7a7160" strokeWidth="5"/><rect x="-4" y="-37" width="217" height="30" rx="3" fill="#38574f"/><text x="104" y="-17" textAnchor="middle" fontSize="13" fontFamily="Georgia,serif" fill="#f4e8cd">{MOUNTAIN_MAP[game.mountainId].name}</text></g>
 </svg></Architecture.Provider>
}
function Chalet({x,y,width,floors,color,sign}:{x:number;y:number;width:number;floors:number;color:string;sign?:string}) {
 const architecture=useContext(Architecture)
 const h=27+floors*20,w=width,rise=w*(['brick','western','modern'].includes(architecture)?.08:architecture==='chalet'?.42:architecture==='onsen'?.15:.24)
 return <g transform={`translate(${x} ${y})`}>
  <ellipse cx="9" cy="6" rx={w*.72} ry="12" fill="#6e8c90" opacity=".2"/>
  <path d={`M${-w/2} 0V${-h}L${w/2} ${-h}V0Z`} fill={color}/>
  <path d={`M${w/2} 0l19-12v${-h}l-19 12Z`} fill="#726f60"/>
  <path d={`M${-w/2-8} ${-h}L0 ${-h-rise} ${w/2+8} ${-h}Z`} fill="#f1f0e4" stroke="#717e7b" strokeWidth="2"/>
  <path d={`M0 ${-h-rise}l19-12 ${w/2+8} ${rise} -19 12Z`} fill="#cad6d2" stroke="#788b88" strokeWidth="1.5"/>
  <path d={`M${-w/2-6} ${-h+3}H${w/2+6}`} stroke="#705c48" strokeWidth="4"/>
  <path d={`M${-w/2} -4H${w/2}`} stroke="#b6ac98" strokeWidth="8"/>
  <path d={`M${w*.2} ${-h-rise*.4}v-18h8v22`} fill="#927b68"/>
  {Array.from({length:floors},(_,row)=>[-1,1].map(side=><g key={`${row}-${side}`} transform={`translate(${side*w*.27} ${-17-row*20})`}><rect x="-6" y="-9" width="12" height="13" className="town-window" fill="#d5dfcf" stroke="#675b49" strokeWidth="2"/><path d="M0 -9V4M-6 -2H6" stroke="#8f7a58" strokeWidth="1"/><path d="M-9 6H9" stroke="#eae9df" strokeWidth="3"/></g>))}
  {['brick','stone','slate'].includes(architecture)&&<path d={`M${-w/2} -8h${w}m${-w} -13h${w}m${-w} -13h${w}`} stroke="#e4d6bd" strokeWidth="1" opacity=".5"/>}
  {['timber','chalet'].includes(architecture)&&<path d={`M${-w/2+3} -6v${-h+9}M${w/2-3} -6v${-h+9}M${-w/2} -28h${w}`} stroke="#6a5d4b" strokeWidth="3"/>}
  {architecture==='western'&&<rect x={-w/2} y={-h-9} width={w} height="13" fill={color} stroke="#79634e" strokeWidth="2"/>}
  {architecture==='onsen'&&<><path d={`M${-w/2-16} ${-h-6}q${w/2+16} 13 ${w+32} 0`} fill="none" stroke="#625f55" strokeWidth="5"/><circle cx={-w/2+5} cy="-29" r="5" fill="#d69663"/></>}
  <path className="town-smoke" d={`M${w*.2+4} ${-h-rise*.4-18}q-7-12 1-22t0-21`} stroke="#eeeade" strokeWidth="4" opacity=".5" fill="none"/>
  <rect x="-7" y="-21" width="14" height="23" rx="2" fill="#655c4a"/><rect x="-4" y="-17" width="8" height="9" fill="#b6d0cc"/>
  {sign&&<g><rect x={-w*.44} y={-h+7} width={w*.88} height="12" rx="1" fill="#36574d"/><text x="0" y={-h+15.5} fill="#f4e7c5" textAnchor="middle" fontSize={sign.length>14?5:6} fontFamily="Georgia,serif" letterSpacing=".8">{sign}</text></g>}
 </g>
}
function Pine({x,y,size=1,color='#52766b'}:{x:number;y:number;size?:number;color?:string}) {return <g transform={`translate(${x} ${y}) scale(${size})`}><ellipse cy="4" rx="15" ry="5" fill="#6b8885" opacity=".16"/><path d="M0 6V-36" stroke="#837964" strokeWidth="4"/><path d="M0-57L-12-33H-7L-18-17H-11L-23 0H23L11-17H18L7-33H12Z" fill={color}/><path d="M0-57L-8-39 1-42 8-38ZM-1-31L-13-17 0-20 12-16Z" fill="#e1e8df" opacity=".8"/></g>}
function MarketStall({x,y,color}:{x:number;y:number;color:string}) {return <g transform={`translate(${x} ${y})`}><path d="M-19 0V-19H19V0" stroke="#8d7559" strokeWidth="3"/><path d="M-24-19L-18-31H18L24-19Z" fill={color}/><path d="M-10-30L-13-19M5-30L6-19" stroke="#e9dfbd" strokeWidth="6"/><rect x="-20" y="-9" width="40" height="8" fill="#a08762"/></g>}
function Bus({x,y}:{x:number;y:number}) {return <g transform={`translate(${x} ${y})`}><ellipse cx="0" cy="7" rx="35" ry="8" fill="#5d787d" opacity=".2"/><rect x="-33" y="-20" width="65" height="24" rx="7" fill="#c89d55"/><rect x="-27" y="-16" width="51" height="10" rx="2" fill="#648b95"/><path d="M-12-16V-6M4-16V-6M19-16V-6" stroke="#d5b573" strokeWidth="3"/><circle cx="-19" cy="4" r="5" fill="#4c5350"/><circle cx="21" cy="4" r="5" fill="#4c5350"/></g>}
function Person({x,y,color}:{x:number;y:number;color:string}) {return <g transform={`translate(${x} ${y})`}><ellipse cy="6" rx="4" ry="2" fill="#748b8b" opacity=".3"/><path d="M-2 2L-3 6M2 2L3 6" stroke="#4e5d59" strokeWidth="2"/><rect x="-3" y="-6" width="6" height="9" rx="2" fill={color}/><circle cy="-8" r="3" fill="#dcb68e"/><path d="M-3-10H3" stroke={color} strokeWidth="2"/></g>}
function Lamp({x,y}:{x:number;y:number}) {return <g transform={`translate(${x} ${y})`}><path d="M0 0V-28" stroke="#5e7068" strokeWidth="2"/><circle className="town-lamp-glow" cy="-27" r="17" fill="#ffd68d" opacity=".22"/><path d="M-5-29L0-35 5-29V-20H-5Z" fill="#f1d394" stroke="#5e7068" strokeWidth="2"/></g>}
function Construction({project,progress}:{project:TownProject;progress:number}) {
 const [x,y]=LOTS[project]
 return <g transform={`translate(${x} ${y})`}><path d="M-54 13L22 25 69 0-15-12Z" fill="#b3b7aa"/><path d="M-50 11V-25M-15 17V-48M22 22V-25M-50-20L22-9M-15-44L49-26M49-26V3" stroke="#ad8d61" strokeWidth="5"/>{progress>.4&&<path d="M-47-25L-10-48 43-28 15-8Z" fill="#c3ad87"/>}<path d="M-65 30H72M-58 24V36M-30 24V36M0 24V36M30 24V36M60 24V36" stroke="#a58359" strokeWidth="4"/><rect x="-50" y="36" width="107" height="19" rx="2" fill="#3e6458"/><text x="4" y="49" textAnchor="middle" fontSize="9" fill="#f3e5c2">{TOWN_PROJECTS[project].name} · building</text></g>
}

function totalLevels(game: GameState) { return Object.values(game.town.levels).reduce((a,b)=>a+b,0) }
