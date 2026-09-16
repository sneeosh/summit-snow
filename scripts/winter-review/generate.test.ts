import {it,expect} from 'vitest'
import {mkdirSync,writeFileSync} from 'node:fs'
import {prepareStrategy,planStrategyDay} from '../winter-strategies'
import {newGame} from '../../src/game/init'
import {openResort,fastForwardDay,startNextDay,tick} from '../../src/game/simulation'
it('generates reproducible review scenes',()=>{
 mkdirSync('public/winter-review',{recursive:true})
 const save=(name:string,s:unknown)=>writeFileSync(`public/winter-review/${name}.json`,JSON.stringify(s))
 save('opening',newGame('scenario',91))
 const s=prepareStrategy(91,'village')
 for(let day=1;day<=60;day++){
  planStrategyDay(s,'village')
  if(day===4){const r=structuredClone(s);r.trails['bunny-hollow'].snowDepthCm=4;r.trails['bunny-hollow'].open=false;save('recovery',r)}
  if(day===54)save('finale',s)
  openResort(s)
  if(day===25){while(s.minute<660)tick(s);save('busy',s)}
  fastForwardDay(s)
  expect(s.day).toBe(day)
  if(day<60)startNextDay(s)
 }
 save('ending',s)
},240000)
