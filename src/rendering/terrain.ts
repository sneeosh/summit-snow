/**
 * Paints the static mountain backdrop (sky, ridgelines, snowfield, forests,
 * village ground) into an offscreen 2D canvas that becomes a single Pixi
 * texture. Canvas2D gives painterly gradients for free; the scene only
 * repaints this when daylight/weather mood changes, not per frame.
 *
 * Forests are procedurally scattered with hash noise but always avoid every
 * trail corridor, so unbuilt trails read as natural clearings.
 */
import { hashNoise } from '../game/rng'
import { LIFT_LINES, TRAILS, WORLD_H, WORLD_W, type MeasuredPath, TRAIL_PATHS } from '../content/mountain'
import type { WeatherDay } from '../game/types'

export interface TerrainMood {
  /** 0..1 cloudiness dims and cools the palette */
  cloud: number
  /** 0..1, poor visibility washes the distance out */
  visibility: number
  snowing: boolean
}

/** the mountain skyline polygon (x rises to summit, ridge, descends right) */
const SKYLINE: [number, number][] = [
  [0, 560],
  [130, 520],
  [300, 460],
  [470, 400],
  [620, 330],
  [780, 230],
  [940, 170],
  [1040, 205],
  [1160, 250],
  [1270, 290],
  [1370, 330],
  [1520, 420],
  [1680, 520],
  [1920, 640],
]

/** distant background ridges, painted in atmospheric blues */
const FAR_RIDGES: [number, number][][] = [
  [
    [0, 480],
    [260, 380],
    [520, 300],
    [760, 250],
    [1020, 300],
    [1310, 260],
    [1560, 340],
    [1920, 460],
  ],
  [
    [0, 560],
    [340, 460],
    [700, 380],
    [1100, 360],
    [1500, 430],
    [1920, 540],
  ],
]

export function paintTerrain(mood: TerrainMood, seed: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = WORLD_W
  canvas.height = WORLD_H
  const ctx = canvas.getContext('2d')!

  const dim = mood.cloud * 0.6 + (1 - mood.visibility) * 0.4 // 0 clear .. ~1 socked in

  // ---- sky
  const sky = ctx.createLinearGradient(0, 0, 0, 660)
  if (dim < 0.35) {
    sky.addColorStop(0, '#aecbe0')
    sky.addColorStop(0.55, '#cfe0ec')
    sky.addColorStop(1, '#e9f1f5')
  } else if (dim < 0.7) {
    sky.addColorStop(0, '#a8b8c4')
    sky.addColorStop(0.6, '#c5d1d9')
    sky.addColorStop(1, '#dfe7eb')
  } else {
    sky.addColorStop(0, '#9aa6ae')
    sky.addColorStop(0.6, '#b8c2c8')
    sky.addColorStop(1, '#d4dbdf')
  }
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, WORLD_W, WORLD_H)

  // low sun, clear days only
  if (dim < 0.35) {
    ctx.save()
    const sunGrad = ctx.createRadialGradient(1560, 150, 8, 1560, 150, 140)
    sunGrad.addColorStop(0, 'rgba(248, 222, 170, 0.95)')
    sunGrad.addColorStop(0.25, 'rgba(248, 222, 170, 0.35)')
    sunGrad.addColorStop(1, 'rgba(248, 222, 170, 0)')
    ctx.fillStyle = sunGrad
    ctx.fillRect(1380, 0, 380, 340)
    ctx.restore()
  }

  // ---- distant ridges
  const ridgeAlpha = Math.max(0.2, mood.visibility)
  const ridgeColors = ['rgba(148, 170, 189, ALPHA)', 'rgba(170, 190, 205, ALPHA)']
  FAR_RIDGES.forEach((ridge, i) => {
    ctx.beginPath()
    ctx.moveTo(ridge[0][0], ridge[0][1])
    for (const [x, y] of ridge) ctx.lineTo(x, y)
    ctx.lineTo(WORLD_W, WORLD_H)
    ctx.lineTo(0, WORLD_H)
    ctx.closePath()
    ctx.fillStyle = ridgeColors[i].replace('ALPHA', String(0.5 * ridgeAlpha + 0.15))
    ctx.fill()
  })

  // ---- main mountain snowfield
  ctx.beginPath()
  ctx.moveTo(SKYLINE[0][0], SKYLINE[0][1])
  for (const [x, y] of SKYLINE) ctx.lineTo(x, y)
  ctx.lineTo(WORLD_W, WORLD_H)
  ctx.lineTo(0, WORLD_H)
  ctx.closePath()
  const snow = ctx.createLinearGradient(0, 150, 0, WORLD_H)
  if (dim < 0.5) {
    snow.addColorStop(0, '#fbfdff')
    snow.addColorStop(0.45, '#eef3f7')
    snow.addColorStop(1, '#dde7ee')
  } else {
    snow.addColorStop(0, '#eff3f6')
    snow.addColorStop(0.5, '#e2e9ee')
    snow.addColorStop(1, '#d3dde4')
  }
  ctx.fillStyle = snow
  ctx.fill()

  // subtle slope shading: broad soft strokes following the fall line
  ctx.save()
  ctx.clip()
  for (let i = 0; i < 26; i++) {
    const n = hashNoise(seed, i, 71)
    const x = n * WORLD_W
    const topY = skylineYAt(x) + 20
    const grad = ctx.createLinearGradient(x, topY, x + 120, WORLD_H)
    grad.addColorStop(0, `rgba(178, 198, 214, ${0.05 + hashNoise(seed, i, 72) * 0.08})`)
    grad.addColorStop(1, 'rgba(178, 198, 214, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(x - 30, topY)
    ctx.quadraticCurveTo(x + 40, (topY + WORLD_H) / 2, x + 10, WORLD_H)
    ctx.lineTo(x + 150, WORLD_H)
    ctx.quadraticCurveTo(x + 160, (topY + WORLD_H) / 2, x + 90, topY)
    ctx.closePath()
    ctx.fill()
  }

  // ---- faint rock bands just under the summit ridgeline
  for (let i = 0; i < SKYLINE.length - 1; i++) {
    const [x0, y0] = SKYLINE[i]
    const [x1, y1] = SKYLINE[i + 1]
    if (y0 > 380) continue
    const n = hashNoise(seed, i, 91)
    if (n < 0.35) continue
    ctx.strokeStyle = `rgba(120, 134, 145, ${0.18 + n * 0.2})`
    ctx.lineWidth = 2 + n * 3
    ctx.lineCap = 'round'
    const mx = (x0 + x1) / 2
    const my = (y0 + y1) / 2
    ctx.beginPath()
    ctx.moveTo(mx - 18 - n * 14, my + 16 + n * 10)
    ctx.quadraticCurveTo(mx, my + 8, mx + 18 + n * 14, my + 18 + n * 12)
    ctx.stroke()
  }

  // ---- forests (avoid all trail corridors + village)
  paintForests(ctx, seed, dim)

  // ---- village ground: gentle warm clearing at the bottom
  const village = ctx.createRadialGradient(980, 1120, 60, 980, 1120, 520)
  village.addColorStop(0, 'rgba(233, 226, 214, 0.55)')
  village.addColorStop(0.6, 'rgba(233, 228, 218, 0.25)')
  village.addColorStop(1, 'rgba(233, 228, 218, 0)')
  ctx.fillStyle = village
  ctx.fillRect(400, 900, 1300, 300)

  ctx.restore()

  // ---- fog wash when visibility is poor
  if (mood.visibility < 0.6) {
    ctx.fillStyle = `rgba(222, 229, 233, ${(0.6 - mood.visibility) * 0.9})`
    ctx.fillRect(0, 0, WORLD_W, WORLD_H)
  }

  return canvas
}

function skylineYAt(x: number): number {
  for (let i = 1; i < SKYLINE.length; i++) {
    if (SKYLINE[i][0] >= x) {
      const [x0, y0] = SKYLINE[i - 1]
      const [x1, y1] = SKYLINE[i]
      const f = (x - x0) / (x1 - x0)
      return y0 + (y1 - y0) * f
    }
  }
  return SKYLINE[SKYLINE.length - 1][1]
}

function distToPath(x: number, y: number, mp: MeasuredPath): number {
  let best = Infinity
  const pts = mp.points
  for (let i = 1; i < pts.length; i++) {
    best = Math.min(best, distToSegment(x, y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y))
  }
  return best
}

function distToSegment(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0
  const dy = y1 - y0
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((px - x0) * dx + (py - y0) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t))
}

function paintForests(ctx: CanvasRenderingContext2D, seed: number, dim: number): void {
  const corridorHalfWidth = (widthM: number) => widthM / 2 + 14

  for (let i = 0; i < 1500; i++) {
    const x = hashNoise(seed, i, 11) * WORLD_W
    const y = hashNoise(seed, i, 12) * WORLD_H

    const skyY = skylineYAt(x)
    if (y < skyY + 30) continue // above treeline near ridge
    if (y < skyY + 120 && hashNoise(seed, i, 13) < 0.7) continue // sparse near treeline
    if (y > 1040) continue // village floor
    // density noise: clumpy forests, open bowls
    const clump = hashNoise(seed, Math.floor(x / 140), Math.floor(y / 140) + 900)
    if (hashNoise(seed, i, 14) > clump * 1.25) continue

    // keep every trail corridor clear
    let blocked = false
    for (const t of TRAILS) {
      if (distToPath(x, y, TRAIL_PATHS[t.id]) < corridorHalfWidth(t.widthM)) {
        blocked = true
        break
      }
    }
    if (blocked) continue
    // keep lift lines clear-ish
    if (nearLiftLine(x, y)) continue

    drawSpruce(ctx, x, y, 7 + hashNoise(seed, i, 15) * 9, hashNoise(seed, i, 16), dim)
  }
}

function nearLiftLine(x: number, y: number): boolean {
  for (const key of Object.keys(LIFT_LINES)) {
    if (distToPath(x, y, LIFT_LINES[key]) < 16) return true
  }
  return false
}

function drawSpruce(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, tone: number, dim: number): void {
  const g = 58 + tone * 26 - dim * 12
  const dark = `rgb(${30 + tone * 14}, ${g}, ${44 + tone * 16})`
  // shadow
  ctx.fillStyle = 'rgba(120, 143, 160, 0.25)'
  ctx.beginPath()
  ctx.ellipse(x + size * 0.22, y + size * 0.16, size * 0.5, size * 0.18, 0, 0, Math.PI * 2)
  ctx.fill()
  // canopy: two stacked triangles
  ctx.fillStyle = dark
  ctx.beginPath()
  ctx.moveTo(x, y - size)
  ctx.lineTo(x + size * 0.42, y - size * 0.25)
  ctx.lineTo(x - size * 0.42, y - size * 0.25)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x, y - size * 0.62)
  ctx.lineTo(x + size * 0.52, y + size * 0.14)
  ctx.lineTo(x - size * 0.52, y + size * 0.14)
  ctx.closePath()
  ctx.fill()
  // snow dusting
  ctx.fillStyle = 'rgba(244, 249, 252, 0.75)'
  ctx.beginPath()
  ctx.moveTo(x, y - size)
  ctx.lineTo(x + size * 0.2, y - size * 0.62)
  ctx.lineTo(x - size * 0.2, y - size * 0.62)
  ctx.closePath()
  ctx.fill()
}

export function moodFromWeather(weather: WeatherDay): TerrainMood {
  return {
    cloud: weather.cloud,
    visibility: weather.visibility,
    snowing: weather.snowfallCm > 0,
  }
}
