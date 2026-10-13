import {useEffect,useRef} from 'react'
/** Tiny independent WebGL control distinguishes host graphics scheduling from mountain complexity. */
export function GraphicsControl(){
 const ref=useRef<HTMLCanvasElement>(null)
 useEffect(()=>{
  const gl=ref.current?.getContext('webgl');if(!gl)return
  let frame=0
  const draw=()=>{gl.clearColor(.25,.45,.5,1);gl.clear(gl.COLOR_BUFFER_BIT);frame=requestAnimationFrame(draw)}
  frame=requestAnimationFrame(draw)
  return()=>{cancelAnimationFrame(frame);gl.getExtension('WEBGL_lose_context')?.loseContext()}
 },[])
 return <main style={{padding:24}}><h1>Independent graphics control</h1><p>A 64 × 64 WebGL canvas, only clearing one color. No Pixi, mountain renderer or simulation work.</p><canvas ref={ref} width={64} height={64}/></main>
}
