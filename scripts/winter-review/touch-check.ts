import {useStore} from '../../src/state/store'
/** Exercise the real canvas listeners. Synthetic pointer events do not certify device hit-testing. */
export function checkTouchPaths():string {
 const canvas=document.querySelector('canvas');if(!canvas)return 'Load a mountain scene first.'
 const original=useStore.getState().buildMode
 const rect=canvas.getBoundingClientRect(),x=rect.left+rect.width*.55,y=rect.top+rect.height*.55
 const event=(type:string,id:number,dx=0,dy=0)=>{
  const target=type==='pointerdown'?canvas:window
  target.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x+dx,clientY:y+dy,bubbles:true}))
 }
 const count=()=>{const b=useStore.getState().buildMode;return b?.type==='draw-trail'?b.points.length:-1}
 try{
  useStore.getState().setBuildMode({type:'draw-trail',points:[]})
  event('pointerdown',1);event('pointerup',1);const tap=count()===1
  event('pointerdown',2);event('pointermove',2,40,20);event('pointerup',2,40,20);const drag=count()===1
  event('pointerdown',3);event('pointerdown',4,50);event('pointermove',4,90);event('pointerup',4,90);event('pointerup',3);const pinch=count()===1
  event('pointerdown',5);event('pointercancel',5);event('pointerup',5);const cancel=count()===1
  event('pointerdown',6,20,40);event('pointerup',6,20,40);const resume=count()===2
  return Object.entries({tap,drag,pinch,cancel,resume}).map(([k,v])=>`${k}: ${v?'PASS':'FAIL'}`).join(' · ')
 }finally{useStore.getState().setBuildMode(original)}
}
