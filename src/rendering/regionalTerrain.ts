/** Procedural game scenery: regional layers reuse the simulation's landforms. */
import { ACTIVE_MOUNTAIN, WORLD_H, WORLD_W } from '../content/mountain'
import { hashNoise } from '../game/rng'
import { elevationAt, skylineYAt } from '../game/terrainModel'

export function paintRegionalHorizon(ctx: CanvasRenderingContext2D, dim: number): boolean {
  const biome = ACTIVE_MOUNTAIN.identity?.biome
  if (!biome) return false
  const ridges = biome === 'hardwood' ? [
    [[-260, 625], [200, 595], [510, 610], [920, 570], [1400, 605], [2180, 590]],
    [[-260, 700], [300, 660], [800, 680], [1200, 630], [1680, 650], [2180, 675]],
  ] : biome === 'birch' ? [
    [[-260, 500], [50, 435], [350, 360], [560, 290], [820, 345], [1220, 405], [1610, 380], [2180, 470]],
    [[-260, 630], [220, 500], [620, 430], [930, 465], [1200, 390], [1620, 475], [2180, 555]],
  ] : [
    [[-260, 560], [140, 255], [300, 355], [510, 170], [710, 380], [1040, 245], [1270, 410], [1610, 190], [1840, 335], [2180, 295]],
    [[-260, 690], [150, 540], [550, 490], [880, 625], [1170, 555], [1600, 495], [2180, 605]],
  ]
  const colors = biome === 'hardwood' ? ['#a9b8b5', '#bec8c0'] : biome === 'birch' ? ['#93adbd', '#bdcdd6'] : ['#728c9d', '#a2b3b5']
  ridges.forEach((ridge, i) => {
    ctx.beginPath()
    ctx.moveTo(ridge[0][0], ridge[0][1])
    for (const [x, y] of ridge) ctx.lineTo(x, y)
    ctx.lineTo(2180, 1460); ctx.lineTo(-260, 1460); ctx.closePath()
    ctx.fillStyle = colors[i]; ctx.globalAlpha = 0.8 - dim * 0.2; ctx.fill()
  })
  ctx.globalAlpha = 1
  if (biome === 'hardwood') {
    // A cultivated horizon and shelterbelts, rather than distant alpine peaks.
    ctx.strokeStyle = '#879d99'; ctx.lineWidth = 2; ctx.globalAlpha = 0.3
    for (let i = 0; i < 9; i++) {
      ctx.beginPath(); ctx.moveTo(-260, 635 + i * 16); ctx.lineTo(2180, 660 + i * 12); ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
  return true
}

/** Soft hillshade from the *same* elevation samples used by trail grading. */
export function paintRegionalRelief(ctx: CanvasRenderingContext2D, dim: number, seed: number): void {
  const identity = ACTIVE_MOUNTAIN.identity
  if (!identity) return
  const step = 8
  const relief = document.createElement('canvas')
  relief.width = WORLD_W / step; relief.height = WORLD_H / step
  const rc = relief.getContext('2d')!
  const pixels = rc.createImageData(relief.width, relief.height)
  for (let y = 0; y < relief.height; y++) for (let x = 0; x < relief.width; x++) {
    const p = { x: x * step, y: y * step }
    if (p.y < skylineYAt(p.x) || p.y > 1040) continue
    const dx = (elevationAt({ x: p.x + step, y: p.y }) - elevationAt({ x: p.x - step, y: p.y })) / (step * 4)
    const dy = (elevationAt({ x: p.x, y: p.y + step }) - elevationAt({ x: p.x, y: p.y - step })) / (step * 4)
    const light = (-dx * 0.7 - dy * 0.35 + 0.65) / Math.sqrt(dx * dx + dy * dy + 1)
    const shade = Math.max(0, Math.min(0.5, (0.86 - light) * 1.5)) * (1 - dim * 0.45)
    const i = (y * relief.width + x) * 4
    pixels.data[i] = 67; pixels.data[i + 1] = 100; pixels.data[i + 2] = 127
    pixels.data[i + 3] = Math.round(shade * 255)
  }
  rc.putImageData(pixels, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(relief, 0, 0, WORLD_W, WORLD_H)

  if (identity.biome === 'tussock') {
    // Ochre scree sits on steep ground; tussock gathers at the lower margins.
    for (let i = 0; i < 1600; i++) {
      const x = hashNoise(seed, i, 501) * WORLD_W
      const y = 400 + hashNoise(seed, i, 502) * 635
      if (y < skylineYAt(x) + 10) continue
      const slope = Math.abs(elevationAt({ x: x + 8, y }) - elevationAt({ x: x - 8, y })) / 32
      if (slope > 0.12) {
        ctx.fillStyle = `rgba(139, 116, 85, ${Math.min(0.6, slope)})`
        ctx.beginPath(); ctx.ellipse(x, y, 4 + slope * 8, 2 + slope * 2, -0.25, 0, Math.PI * 2); ctx.fill()
      }
    }
  }
}

/** Returns false for conifer regions so the original tree painter remains. */
export function paintRegionalTree(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, tone: number, dim: number): boolean {
  const biome = ACTIVE_MOUNTAIN.identity?.biome
  if (!biome || biome === 'tussock') return false
  const birch = biome === 'birch'
  const h = size * (birch ? 1.75 : 1.35)
  ctx.strokeStyle = `rgba(105, 127, 149, ${0.2 - dim * 0.08})`; ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + h * 0.65, y + h * 0.24); ctx.stroke()
  ctx.strokeStyle = birch ? '#6d7679' : '#676058'
  ctx.lineWidth = birch ? 3.5 : 2.3; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (tone - 0.5) * 4, y - h); ctx.stroke()
  if (birch) {
    ctx.strokeStyle = '#f4f1e6'; ctx.lineWidth = 2.2
    ctx.beginPath(); ctx.moveTo(x - 0.6, y - 1); ctx.lineTo(x + (tone - 0.5) * 4 - 0.6, y - h); ctx.stroke()
    ctx.strokeStyle = '#596873'; ctx.lineWidth = 1
    for (let k = 1; k < 5; k++) {
      ctx.beginPath(); ctx.moveTo(x - 1, y - h * k / 5); ctx.lineTo(x + 1.5, y - h * k / 5 - 0.5); ctx.stroke()
    }
  }
  ctx.strokeStyle = birch ? '#788690' : '#777169'; ctx.lineWidth = 0.9
  for (let k = 0; k < 5; k++) {
    const side = k % 2 ? 1 : -1
    const by = y - h * (0.34 + k * 0.1)
    const bx = x + side * h * (0.24 - k * 0.025)
    ctx.beginPath(); ctx.moveTo(x, by + 3); ctx.lineTo(bx, by - h * 0.18); ctx.lineTo(bx + side * 2, by - h * 0.3); ctx.stroke()
  }
  if (birch) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath()
    ctx.ellipse(x, y + 1, size * 0.43, size * 0.16, 0, 0, Math.PI * 2); ctx.fill()
  }
  return true
}

export function paintRegionalVillage(ctx: CanvasRenderingContext2D): void {
  const m = ACTIVE_MOUNTAIN
  if (!m.identity) return
  const base = m.nodes.find((n) => n.isBase)!.pos
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#bac4c8'; ctx.lineWidth = 18
  ctx.beginPath(); ctx.moveTo(m.entrance.x, 1460); ctx.lineTo(m.entrance.x, m.entrance.y + 20)
  ctx.lineTo(base.x, 1125); ctx.stroke()
  ctx.strokeStyle = '#f9f7ef'; ctx.lineWidth = 11
  ctx.beginPath(); ctx.moveTo(base.x, 1125); ctx.lineTo(base.x, base.y); ctx.stroke()
  for (const slot of m.facilitySlots.filter((s) => s.prebuilt && !s.id.startsWith('p'))) {
    ctx.beginPath(); ctx.moveTo(base.x, 1125); ctx.lineTo(slot.pos.x, slot.pos.y + 10); ctx.stroke()
  }
  if (m.identity.biome === 'tussock') {
    ctx.strokeStyle = '#bdac86'; ctx.lineWidth = 1.3
    for (let i = 0; i < 160; i++) {
      const x = hashNoise(67, i, 19) * WORLD_W, y = 1050 + hashNoise(67, i, 20) * 130
      if (Math.abs(x - base.x) < 200 || Math.abs(x - m.entrance.x) < 70) continue
      ctx.beginPath(); ctx.moveTo(x - 3, y - 4); ctx.lineTo(x, y); ctx.lineTo(x + 2, y - 6); ctx.stroke()
    }
  }
}
