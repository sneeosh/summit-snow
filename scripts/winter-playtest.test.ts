import { it,expect } from 'vitest'
import { writeFileSync } from 'node:fs'
import { prepareStrategy, planStrategyDay } from './winter-strategies'
import type { Strategy } from './winter-strategies'
import { openResort,fastForwardDay,startNextDay } from '../src/game/simulation'
const rows:string[]=[]
for(const seed of [11,42,91]) for(const strategy of ['learners','terrain','village'] as Strategy[]) {
 it(`${strategy} winter, seed ${seed}`,()=>{
  let s=prepareStrategy(seed,strategy)
  for(let i=0;i<60;i++) {
   planStrategyDay(s,strategy)
   openResort(s);fastForwardDay(s)
   expect(Number.isFinite(s.cash)).toBe(true)
   expect(s.winter.days.at(-1)!.guests).toBeLessThanOrEqual(s.winter.openingDemand!.admitted+1)
   if(s.day===20){const restored=JSON.parse(JSON.stringify(s));expect(restored).toEqual(s);s=restored}
   if(s.gameOver)break
   startNextDay(s)
  }
  const w=s.winter,days=w.days
  rows.push(`| ${seed} | ${strategy} | ${s.day} | ${Math.round(s.cash)} | ${Math.round(days.reduce((n,d)=>n+d.profit,0))} | ${days.reduce((n,d)=>n+d.guests,0)} | ${(days.reduce((n,d)=>n+d.satisfaction,0)/days.length).toFixed(1)} | ${w.setback?.day??'—'} / ${w.setback?.recoveredDay??'—'} | ${Object.values(s.trails).filter(t=>t.built).length} / ${Object.values(s.town.levels).reduce((a,b)=>a+b,0)} | ${s.hostedEvents.at(-1)?.status??'not booked'} |`)
  writeFileSync('docs/winter-balance.md',`# Winter strategy probe\n\nReal scenario starting cash ($80,000), unmodified weather. Terrain takes the existing expansion loan; other strategies wait for earned cash. Each uses staffed rentals, $45 adult tickets, active snow management, then conditional investments. Policies are explicit in scripts/winter-strategies.ts. These are heuristic strategies, not optimal players. Results include debt service in cash; profit is operating profit.\n\n| Seed | Strategy | Last day | Cash | Operating profit | Arrivals | Mean daily satisfaction | Setback / recovery | Runs / town upgrades | Finale |\n|---|---|---:|---:|---:|---:|---:|---|---|---|\n${rows.join('\n')}\n`)
 })
}
