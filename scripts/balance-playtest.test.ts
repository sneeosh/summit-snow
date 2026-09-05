/** Run with: npm run playtest:balance
 * Set SUMMIT_BALANCE_REPORT=1 to refresh docs/balance-playtest.md.
 * Acquisition cases receive a controlled company bankroll, not simulated earnings.
 */
import { expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { MOUNTAINS } from '../src/content/mountains'
import { STARTING_CASH_SANDBOX } from '../src/content/balance'
import { newGame } from '../src/game/init'
import { buyResort, switchResort } from '../src/game/company'
import { buildFacility, setStaffCount, setLiftOpen } from '../src/game/actions'
import { openResort, fastForwardDay, startNextDay } from '../src/game/simulation'
import type { GameState } from '../src/game/types'

it('compares a first week with and without staffed rentals across three seeds', () => {
 const rows: string[] = []
 for (const mountain of MOUNTAINS) {
  for (const rentals of [false,true]) {
   const profit:number[]=[], satisfaction:number[]=[], closing:number[]=[]
   for (const seed of [11,71,91]) {
    let state = newGame('sandbox',seed, mountain.price <= STARTING_CASH_SANDBOX ? mountain.id : 'prairie')
    if(mountain.price > STARTING_CASH_SANDBOX) {
     state.cash = mountain.price + 150_000
     expect(buyResort(state,mountain.id)).toBeNull()
     const next = switchResort(state,mountain.id)
     expect(typeof next).toBe('object')
     state = next as GameState
     expect(state.cash).toBe(150_000)
    }
    if(rentals) {
     expect(buildFacility(state,'v3','rental-shop')).toBeNull()
     expect(setStaffCount(state,'rental',2)).toBeNull()
    }
    for(const lift of Object.values(state.lifts)) expect(setLiftOpen(state,lift.siteId,true)).toBeNull()
    for(let d=0;d<7;d++) {
     openResort(state); fastForwardDay(state)
     expect(state.phase).toBe('day-end')
     expect(state.gameOver).toBe(false)
     if(d<6) startNextDay(state)
    }
    profit.push(state.reports.reduce((n,r)=>n+r.netProfit,0))
    satisfaction.push(state.reports.reduce((n,r)=>n+r.avgSatisfaction,0)/7)
    closing.push(state.cash)
   }
   const range=(ns:number[])=>`${Math.round(Math.min(...ns)).toLocaleString('en-US')}–${Math.round(Math.max(...ns)).toLocaleString('en-US')}`
   rows.push(`| ${mountain.name} | ${rentals?'Staffed rentals':'Starter only'} | ${range(profit)} | ${range(satisfaction)} | ${range(closing)} |`)
  }
 }
 const report = `# First-week operating probe\n\nThree seeds (11, 71, 91), seven operating days each. Starting hills use the normal $500,000 budget less purchase price. Later hills are bought through the company flow with $150,000 remaining after acquisition; that bankroll is a controlled assumption, not earned progression. Staffed rentals cost $20,000 plus staff wages. Every build and staffing action is checked for success. No additional terrain is built.\n\n| Mountain | Setup | Week operating profit ($) | Mean satisfaction | Closing cash ($) |\n|---|---|---:|---:|---:|\n${rows.join('\n')}\n\nRanges span the three seeds. Operating profit excludes construction spending; closing cash includes it. This checks starter operations and the value of rental service. It does not establish late-season snow reliability, expansion returns, acquisition pacing, or long-term balance.\n`
 console.log(report)
 if(process.env.SUMMIT_BALANCE_REPORT === '1') writeFileSync('docs/balance-playtest.md',report)
},60000)
