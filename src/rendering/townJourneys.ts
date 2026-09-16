/** A round trip with five-minute stops at each end; no clock-boundary teleport. */
export function shuttleProgress(minute:number):number {
 const t=((minute%40)+40)%40
 return t<5?.12:t<20?.12+(t-5)/15*.76:t<25?.88:.88-(t-25)/15*.76
}
