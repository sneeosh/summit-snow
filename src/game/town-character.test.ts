import { describe, it, expect } from 'vitest'
import { newGame } from './init'
import { adoptTownPolicy, proposeTownProject } from './actions'
import { advanceTown, townBenefits } from './town'

describe('village character and history', () => {
 it('keeps immutable opening memories with the promised housing', () => {
  const s=newGame('sandbox',71,'prairie'); s.cash=1_000_000
  const first=JSON.stringify(s.town.scrapbook[0])
  expect(proposeTownProject(s,'inn',true)).toBeNull()
  while(s.town.construction) {s.day++;advanceTown(s)}
  expect(s.town.scrapbook).toHaveLength(2)
  expect(s.town.scrapbook[1].compactHomes).toBe(1)
  expect(s.town.scrapbook[1].levels.inn).toBe(1)
  s.town.levels.inn=2
  expect(s.town.scrapbook[1].levels.inn).toBe(1)
  expect(JSON.stringify(s.town.scrapbook[0])).toBe(first)
 })
 it('rejects unavailable charters atomically and never charges twice', () => {
  const s=newGame('sandbox',71,'alder');s.cash=1_000_000
  const before=JSON.stringify(s)
  expect(adoptTownPolicy(s,'winterMarket')).not.toBeNull()
  expect(JSON.stringify(s)).toBe(before)
  expect(adoptTownPolicy(s,'darkSky')).toBeNull()
  const adopted=JSON.stringify(s)
  expect(adoptTownPolicy(s,'darkSky')).not.toBeNull()
  expect(JSON.stringify(s)).toBe(adopted)
  expect(s.town.scrapbook[0].policies.darkSky).toBe(false)
  expect(s.town.scrapbook[1].policies.darkSky).toBe(true)
 })
 it('delivers charter benefits and rejects opposition, low funds and late proposals', () => {
  const s=newGame('sandbox',71,'alder');s.cash=1_000_000;s.town.levels.mainstreet=1
  const before=townBenefits(s)
  expect(adoptTownPolicy(s,'winterMarket')).toBeNull()
  expect(townBenefits(s).demandMultiplier).toBeCloseTo(before.demandMultiplier+.03)
  expect(townBenefits(s).dailyCost).toBe(before.dailyCost+60)
  expect(adoptTownPolicy(s,'darkSky')).toBeNull()
  expect(townBenefits(s).dailyCost).toBeCloseTo((before.dailyCost+60)*.8)
  for(const reason of ['cash','phase','votes']) {
   const t=newGame('sandbox',71,'alder');t.cash=reason==='cash'?0:1_000_000
   if(reason==='phase')t.phase='operating'
   if(reason==='votes')t.town.trust={residents:0,businesses:0,conservation:0}
   const original=JSON.stringify(t)
   expect(adoptTownPolicy(t,'darkSky')).not.toBeNull()
   expect(JSON.stringify(t)).toBe(original)
  }
 })
})
