import { expect, it } from 'vitest'
import { sustainedGradient } from './trailGradient'
import { newGame } from './init'
import { analyzePath } from './trails'
import { ensureMountain } from '../content/mountain'

it('grades a brief rollover without making an entire cruiser expert terrain', () => {
 expect(sustainedGradient([{horizM:100,dropM:10},{horizM:10,dropM:8},{horizM:100,dropM:10}])).toBeCloseTo(.17)
 expect(sustainedGradient([{horizM:100,dropM:65},{horizM:100,dropM:10}])).toBeCloseTo(.65)
})
it('finds a steep pitch straddling segment boundaries and ignores waypoint density', () => {
 const original = [{horizM:60,dropM:6},{horizM:60,dropM:36},{horizM:60,dropM:36},{horizM:60,dropM:6}]
 expect(sustainedGradient(original)).toBeCloseTo(.6)
 expect(sustainedGradient(original.flatMap(s=>Array.from({length:6},()=>({horizM:s.horizM/6,dropM:s.dropM/6}))))).toBeCloseTo(.6)
})
it('handles short and degenerate paths without hiding descents behind climbs', () => {
 expect(sustainedGradient([])).toBe(0)
 expect(sustainedGradient([{horizM:0,dropM:0}])).toBe(0)
 expect(sustainedGradient([{horizM:20,dropM:10}])).toBe(.5)
 expect(sustainedGradient([{horizM:50,dropM:30},{horizM:50,dropM:-30}])).toBe(.3)
})
it('marks uphill locations in the same map progress coordinates as skiers', () => {
 newGame('sandbox',71,'alder')
 ensureMountain('alder',1)
 const points = [{x:800,y:500},{x:800,y:800},{x:1100,y:700},{x:1100,y:1000}]
 const a=analyzePath(points)
 const total=300+Math.hypot(300,100)+300
 expect(a.uphillSegments[0].t0).toBeCloseTo(300/total)
 expect(a.uphillSegments[0].t1).toBeCloseTo((300+Math.hypot(300,100))/total)
})
