import type { GameState } from '../../src/game/types'
export interface Capture { build: string; seed: number; feedback: string; state: GameState; digest: string }
export async function stateDigest(state: GameState): Promise<string> {
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(state)))
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')
}
export async function captureState(build:string, state:GameState, feedback:string):Promise<Capture>{
 const copy=JSON.parse(JSON.stringify(state)) as GameState
 return {build,seed:copy.seed,feedback,state:copy,digest:await stateDigest(copy)}
}
export async function readCapture(text:string,build:string):Promise<Capture>{
 const c=JSON.parse(text) as Capture
 if(c.build!==build)throw Error('Build mismatch: use the recorded commit and source fingerprint.')
 if(!c.state||c.seed!==c.state.seed||!c.state.winter||!Array.isArray(c.state.weatherSeason))throw Error('Invalid feedback save.')
 if(c.digest!==await stateDigest(c.state))throw Error('Save checksum mismatch: this capture was changed.')
 return c
}
