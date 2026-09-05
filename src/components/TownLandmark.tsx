import { TOWN_IDENTITIES } from '../content/town'

/** Fixed gathering places give each village a different silhouette and social heart. */
export function TownLandmark({ mountainId, active }: { mountainId: string; active: boolean }) {
 const identity = TOWN_IDENTITIES[mountainId] ?? TOWN_IDENTITIES.alder
 return <g transform="translate(455 555)" aria-label={identity.landmark}>
  <ellipse rx="105" ry="43" fill="#e5e6da" stroke="#faf3df" strokeWidth="7"/>
  {mountainId==='prairie' ? <><ellipse rx="90" ry="33" fill="#a5cbd3" stroke="#b9aa90" strokeWidth="4"/><path d="M-67 8Q-20-24 60 10M-40 22Q5-4 49 19" stroke="#e8f4ed" fill="none"/>{active&&[-42,12,53].map((x,i)=><g key={x} transform={`translate(${x} ${i%2?12:-7})`}><circle cy="-14" r="3" fill="#d7ad87"/><path d="M0-10V0L-7 5M0 0L7 4" stroke={i%2?'#547588':'#ad604b'} strokeWidth="4"/></g>)}</> :
  mountainId==='yuki' ? <><ellipse rx="67" ry="27" fill="#749fa4" stroke="#8b9284" strokeWidth="10"/>{[-40,0,35].map(x=><path key={x} className="town-smoke" d={`M${x} -8q-12-16 0-29t0-22`} fill="none" stroke="#f2f0dc" strokeWidth="5" opacity=".6"/>)}{[-83,83].map(x=><g key={x}><path d={`M${x} 6V-47`} stroke="#645b48" strokeWidth="4"/><rect x={x-8} y="-44" width="16" height="21" rx="6" fill="#d08c55"/><path d={`M${x-5}-38h10m-10 9h10`} stroke="#f6d795"/></g>)}</> :
  mountainId==='granite' ? <><path d="M-21 17V-69H21V17Z" fill="#8d9692"/><path d="M-28-69L0-90 28-69Z" fill="#586773"/><circle cy="-48" r="15" fill="#f4e8c7" stroke="#55645e" strokeWidth="3"/><path d="M0-58V-48L8-44" stroke="#55645e" strokeWidth="2"/>{[-65,65].map(x=><path key={x} d={`M${x-16} 15h32m-27 0v10m22-10v10`} stroke="#97765a" strokeWidth="5"/>)}</> :
  mountainId==='alder' ? <><path d="M-86 4L70-23 89 13-65 36Z" fill="#a48b68"/>{Array.from({length:12},(_,i)=><path key={i} d={`M${-76+i*13} ${2-i*2}l17 32`} stroke="#806f57"/>)}<path d="M-68-5L68-27M-65-5v-15M-10-14v-15M65-27v-15" stroke="#6d735e" strokeWidth="4"/><path d="M0 4V-63L18-51 0-40-18-51Z" fill="#8b6147"/></> :
  mountainId==='kea' ? <><ellipse rx="92" ry="33" fill="#80b6ba"/><path d="M-67 22L5-7 72 10 8 36Z" fill="#af9e7e"/><path d="M-20 11L11-21 40 1Z" fill="#d5d2be"/><path d="M10 7V-17" stroke="#515f58" strokeWidth="4"/></> :
  mountainId==='elk' ? <><ellipse rx="34" ry="16" fill="#a1927b"/><path d="M-8 4L0-22 10-3 4-8 1 6Z" fill="#d78d46"/>{[-65,65].map(x=><g key={x}><path d={`M${x} 20V-64m0 19l-16-17m16 5l18-13`} stroke="#d1d2bf" strokeWidth="6"/><path d={`M${x-4}-14h8m-8-19h8m-8-20h8`} stroke="#69776c" strokeWidth="2"/></g>)}</> :
  mountainId==='wasatch' ? <>{[-53,0,48].map((x,i)=><path key={x} d={`M${x-27} 17l7-${35+i*9} 25-13 22 22-4 29Z`} fill={['#b4a796','#998f80','#c8bca6'][i]} stroke="#847f73" strokeWidth="2"/>)}<path d="M-10-10L3-27 9-8 20 0" stroke="#b8734e" strokeWidth="4" fill="none"/></> : <>{[-55,0,55].map(x=><g key={x}><ellipse cx={x} cy="12" rx="16" ry="6" fill="#a18869"/><path d={`M${x} 24V-27`} stroke="#766953" strokeWidth="3"/><path d={`M${x-25}-20l25-16 25 16Z`} fill="#b96f5e"/><path d={`M${x-22} 18v12m44-12v12`} stroke="#61766c" strokeWidth="4"/></g>)}</>}
  <text y="58" textAnchor="middle" fontFamily="Georgia,serif" fontSize="11" fill="#52645a">{identity.landmark}</text>
 </g>
}
