import {expect,it} from 'vitest'
import {shuttleProgress} from './townJourneys'
it('dwells at both ends and returns without teleporting',()=>{
 expect(shuttleProgress(0)).toBe(shuttleProgress(4))
 expect(shuttleProgress(20)).toBe(shuttleProgress(24))
 expect(shuttleProgress(12)).toBeGreaterThan(shuttleProgress(5))
 expect(shuttleProgress(32)).toBeLessThan(shuttleProgress(25))
 expect(Math.abs(shuttleProgress(39.999)-shuttleProgress(40))).toBeLessThan(.001)
})
