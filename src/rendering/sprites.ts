/**
 * Procedural guest sprites: tiny vector skiers, snowboarders, and standing
 * figures baked into a small cache of canvas textures. Poses encode carve
 * lean (-2..2); the scene rotates sprites to their travel direction and
 * sways them side to side, so guests visibly link S-turns down the hill.
 *
 * All figures are drawn heading +Y (down-screen) at 3× and scaled down for
 * crisp edges at any zoom.
 */
import { Texture } from 'pixi.js'

export type GuestStyle = 'ski' | 'board' | 'stand'

export const JACKETS = ['#c0392b', '#2f6fb2', '#2e7d4f', '#e8912c', '#7d4fa8', '#d95d2e', '#26343d', '#c2185b']
const PANTS = '#2b3a44'
const SKIN = '#e8bd96'
const SKI_COLOR = '#37474f'
const BOARD_COLORS = ['#0d8a83', '#c74f2e', '#31518f']
const POLE = '#7a5c3e'

const S = 3 // bake scale
const W = 30
const H = 36
const CX = W / 2
const CY = H / 2

const cache = new Map<string, Texture>()

export function guestTexture(style: GuestStyle, pose: number, paletteIdx: number): Texture {
  const p = Math.max(-2, Math.min(2, Math.round(pose)))
  const key = `${style}|${p}|${paletteIdx}`
  const hit = cache.get(key)
  if (hit) return hit

  const canvas = document.createElement('canvas')
  canvas.width = W * S
  canvas.height = H * S
  const ctx = canvas.getContext('2d')!
  ctx.scale(S, S)
  ctx.lineCap = 'round'

  const jacket = JACKETS[paletteIdx % JACKETS.length]
  if (style === 'ski') drawSkier(ctx, p, jacket)
  else if (style === 'board') drawBoarder(ctx, p, jacket, BOARD_COLORS[paletteIdx % BOARD_COLORS.length])
  else drawStanding(ctx, jacket)

  const texture = Texture.from(canvas)
  cache.set(key, texture)
  return texture
}

function drawSkier(ctx: CanvasRenderingContext2D, pose: number, jacket: string): void {
  const lean = pose * 0.24
  ctx.save()
  ctx.translate(CX, CY)
  ctx.rotate(lean)

  // skis: two runners, tips downhill (+y), splayed a touch in a carve
  ctx.strokeStyle = SKI_COLOR
  ctx.lineWidth = 2.2
  const splay = Math.abs(pose) * 0.35
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.rotate(side * splay * 0.08)
    ctx.beginPath()
    ctx.moveTo(side * 3.1, -9)
    ctx.lineTo(side * 3.1, 13)
    ctx.stroke()
    // tip curl dot
    ctx.fillStyle = SKI_COLOR
    ctx.beginPath()
    ctx.arc(side * 3.1, 13.6, 1.15, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // poles trail behind (−y), flaring outward
  ctx.strokeStyle = POLE
  ctx.lineWidth = 1
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * 4.6, -1.5)
    ctx.lineTo(side * 7.6, -10.5)
    ctx.stroke()
  }

  // legs (crouched)
  ctx.strokeStyle = PANTS
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(-2.4, 3.4)
  ctx.lineTo(-3, 0.5)
  ctx.moveTo(2.4, 3.4)
  ctx.lineTo(3, 0.5)
  ctx.stroke()

  // torso leaning downhill
  ctx.fillStyle = jacket
  roundRect(ctx, -3.6, -8.5, 7.2, 11, 3.4)
  // arms reaching to the pole grips
  ctx.strokeStyle = jacket
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(-2.8, -4)
  ctx.lineTo(-4.8, -1.4)
  ctx.moveTo(2.8, -4)
  ctx.lineTo(4.8, -1.4)
  ctx.stroke()

  head(ctx, 0, -10.6, jacket)
  ctx.restore()
}

function drawBoarder(ctx: CanvasRenderingContext2D, pose: number, jacket: string, board: string): void {
  const lean = pose * 0.3
  ctx.save()
  ctx.translate(CX, CY)
  ctx.rotate(lean)

  // board: one deck, ridden sideways-ish across the fall line
  ctx.save()
  ctx.rotate(1.05)
  ctx.strokeStyle = board
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(-10, 2)
  ctx.lineTo(10, 2)
  ctx.stroke()
  ctx.restore()

  // legs in the sideways stance
  ctx.strokeStyle = PANTS
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(-3.4, 2.4)
  ctx.lineTo(-2.4, -0.4)
  ctx.moveTo(3.6, 0.2)
  ctx.lineTo(2.6, -1.6)
  ctx.stroke()

  // torso, counter-rotated the way riders actually face
  ctx.save()
  ctx.rotate(-0.32)
  ctx.fillStyle = jacket
  roundRect(ctx, -3.7, -8.5, 7.4, 10.6, 3.4)
  // arms out for balance
  ctx.strokeStyle = jacket
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(-3.4, -5)
  ctx.lineTo(-7.6, -3.4)
  ctx.moveTo(3.4, -5)
  ctx.lineTo(7.6, -6.4)
  ctx.stroke()
  head(ctx, 0, -10.4, jacket)
  ctx.restore()

  ctx.restore()
}

function drawStanding(ctx: CanvasRenderingContext2D, jacket: string): void {
  ctx.save()
  ctx.translate(CX, CY)
  // upright figure, no gear underfoot
  ctx.strokeStyle = PANTS
  ctx.lineWidth = 2.8
  ctx.beginPath()
  ctx.moveTo(-1.8, 8.5)
  ctx.lineTo(-1.8, 3)
  ctx.moveTo(1.8, 8.5)
  ctx.lineTo(1.8, 3)
  ctx.stroke()
  ctx.fillStyle = jacket
  roundRect(ctx, -3.4, -6.5, 6.8, 10.4, 3.2)
  head(ctx, 0, -8.8, jacket)
  ctx.restore()
}

function head(ctx: CanvasRenderingContext2D, x: number, y: number, beanie: string): void {
  ctx.fillStyle = SKIN
  ctx.beginPath()
  ctx.arc(x, y, 2.6, 0, Math.PI * 2)
  ctx.fill()
  // beanie matches the jacket
  ctx.fillStyle = beanie
  ctx.beginPath()
  ctx.arc(x, y - 0.4, 2.6, Math.PI, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(x, y - 2.8, 1, 0, Math.PI * 2)
  ctx.fill()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
}

/** stable per-guest look: ~28% ride boards; jackets spread across the palette */
export function guestLook(guestId: number): { rides: 'ski' | 'board'; palette: number } {
  const h = (guestId * 2654435761) >>> 0
  return {
    rides: h % 100 < 28 ? 'board' : 'ski',
    palette: (h >>> 8) % JACKETS.length,
  }
}
