import {it,expect} from 'vitest'
import {captureState,readCapture} from '../../scripts/winter-review/capture'
import {newGame} from '../game/init'
import {openResort,fastForwardDay} from '../game/simulation'
it('capture remains immutable and restored RNG produces the same day',async()=>{
 const g=newGame('scenario',91);openResort(g)
 const c=await captureState('test-build',g,'snow feedback'),before=JSON.stringify(c)
 fastForwardDay(g)
 expect(JSON.stringify(c)).toBe(before)
 const loaded=await readCapture(before,'test-build');fastForwardDay(loaded.state)
 expect(loaded.state).toEqual(g)
 await expect(readCapture(before,'different-build')).rejects.toThrow('Build mismatch')
 c.state.cash++
 await expect(readCapture(JSON.stringify(c),'test-build')).rejects.toThrow('checksum')
})
