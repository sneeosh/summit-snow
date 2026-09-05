import { Graphics } from 'pixi.js'
import { rescueProgress } from '../game/rescue'
import type { GameState } from '../game/types'

/** Stylized injury, splint, patrol response and transport; no simulation mutations. */
export function paintRescues(g: Graphics, state: GameState, reducedMotion: boolean): void {
  g.clear()
  for (const incident of state.rescuesToday) {
    if (incident.completed) continue
    const motion = rescueProgress(incident, state.minute)
    const { x, y } = reducedMotion ? incident.location : motion.position
    // Orange safety perimeter remains at the accident site during treatment.
    if (motion.progress === 0) {
      g.circle(x, y, 22).stroke({ color: 0xe88637, width: 2, alpha: 0.7 })
      for (const side of [-1, 1]) {
        g.moveTo(x + side * 25, y - 12).lineTo(x + side * 25, y + 12).stroke({ color: 0xcf523e, width: 2 })
      }
    }
    // Stretcher, lying skier and a visible leg splint distinguish an injury from skiing.
    g.roundRect(x - 11, y - 5, 23, 10, 3).fill(0xd75435)
    g.roundRect(x - 6, y - 3, 13, 6, 2).fill(0x254963)
    g.circle(x - 7, y, 3).fill(0xf0d0ac)
    g.moveTo(x + 3, y + 1).lineTo(x + 10, y + 3).stroke({ color: 0xf4efe3, width: 3 })
    g.moveTo(x - 13, y + 8).lineTo(x + 14, y + 8).stroke({ color: 0x4b5664, width: 2 })
    // Patroller approaches from downhill, then attends and accompanies the sled.
    const approach = reducedMotion ? 1 : Math.min(1, motion.elapsed / incident.responseMinutes)
    const py = y + 12 + (1 - approach) * 50
    g.roundRect(x - 3, py - 4, 6, 9, 2).fill(0xc93834)
    g.circle(x, py - 7, 3).fill(0xf0d0ac)
    g.rect(x - 2, py - 1, 4, 1.5).fill(0xffffff)
    g.rect(x - 0.75, py - 2, 1.5, 4).fill(0xffffff)
    if (incident.transport !== 'helicopter') continue
    // Helicopter approaches, hovers for loading, and flies the stretcher off the hill.
    const flight = reducedMotion ? 1 : Math.min(1, motion.elapsed / motion.departure)
    const hx = x + (1 - flight) * 130, hy = y - 28 - (1 - flight) * 100
    g.ellipse(hx, y + 12, 23, 7).fill({ color: 0x314759, alpha: 0.2 })
    g.moveTo(hx - 10, hy).lineTo(hx - 39, hy - 8).lineTo(hx - 37, hy - 17).stroke({ color: 0xdf5738, width: 5 })
    g.ellipse(hx, hy, 19, 10).fill(0xe85a3c)
    g.ellipse(hx + 10, hy - 2, 7, 6).fill(0xb9e2ea)
    g.rect(hx - 5, hy - 4, 3, 9).fill(0xffffff)
    g.rect(hx - 8, hy - 1, 9, 3).fill(0xffffff)
    g.moveTo(hx - 12, hy + 13).lineTo(hx + 17, hy + 13).stroke({ color: 0x394b5b, width: 2 })
    g.moveTo(hx, hy - 8).lineTo(hx, hy - 16).stroke({ color: 0x394b5b, width: 2 })
    const rotor = reducedMotion ? 30 : 12 + Math.abs(Math.sin(motion.elapsed * 9)) * 22
    g.moveTo(hx - rotor, hy - 16).lineTo(hx + rotor, hy - 16).stroke({ color: 0x394b5b, width: 2 })
    if (flight === 1) g.moveTo(hx, hy + 9).lineTo(x, y - 5).stroke({ color: 0x394b5b, width: 1 })
  }
}
