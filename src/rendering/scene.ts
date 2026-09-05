/**
 * MountainScene — owns the Pixi stage: camera, terrain backdrop, trails,
 * lifts (with animated chairs), buildings, guest dots, weather particles,
 * overlays, selection highlights, and build-mode previews.
 *
 * Static structure (trails/lifts/buildings) rebuilds only when a structure
 * key changes; guests and chairs update every animation frame.
 */
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import { ACTIVE_MOUNTAIN, ensureMountain, FACILITY_SLOTS, measurePath, NODE_MAP, pointAt, TRAIL_MAP, WORLD_H, WORLD_W } from '../content/mountain'
import { FACILITIES } from '../content/balance'
import { nearestOnTrail } from '../game/junctions'
import { hashNoise } from '../game/rng'
import { isLiftRunning } from '../game/resort'
import {
  allNodes,
  allTrailDefs,
  analyzePath,
  builtClearings,
  getLiftLine,
  getLiftSite,
  getTrailPath,
  nearestNodeId,
  planCustomLift,
} from '../game/trails'
import { routeWindMultiplier, skylineYAt } from '../game/terrainModel'
import { darkness, paintVillageLife } from './villageLife'
import { paintRescues } from './rescues'
import { guestLook, guestTexture } from './sprites'
import type { GameState, TrailDef, TrailState, Vec2 } from '../game/types'
import type { BuildMode, Overlay, Selection } from '../state/store'
import { moodFromWeather, paintTerrain, WORLD_PAD } from './terrain'

const DIFF_COLOR: Record<string, number> = {
  green: 0x2e7d4f,
  blue: 0x2f6fb2,
  black: 0x22262a,
  'double-black': 0x22262a,
}

/**
 * The ski-area boundary: orange ropes with pennants down the side edges and
 * along the base, where the terrain genuinely continues. The ridgeline is
 * NOT roped — the whole face up to the top of the mountain is in play.
 */
function makeBoundary(): Container {
  const c = new Container()
  const g = new Graphics()
  const inset = 8

  const segments: Vec2[][] = [
    // left edge: ridge down to the bottom corner
    [
      { x: inset, y: skylineYAt(inset) + 6 },
      { x: inset, y: WORLD_H - inset },
    ],
    // base of the world
    [
      { x: inset, y: WORLD_H - inset },
      { x: WORLD_W - inset, y: WORLD_H - inset },
    ],
    // right edge: bottom corner up to the ridge
    [
      { x: WORLD_W - inset, y: WORLD_H - inset },
      { x: WORLD_W - inset, y: skylineYAt(WORLD_W - inset) + 6 },
    ],
  ]

  for (const seg of segments) {
    const mp = measurePath(seg)
    // dashed rope
    let d = 0
    while (d < mp.total) {
      const a = pointAt(mp, d / mp.total)
      const b = pointAt(mp, Math.min(1, (d + 9) / mp.total))
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 2, color: 0xd95d2e, alpha: 0.55, cap: 'round' })
      d += 16
    }
    // pennant flags on posts
    for (let f = 40; f < mp.total; f += 150) {
      const p = pointAt(mp, f / mp.total)
      g.moveTo(p.x, p.y).lineTo(p.x, p.y - 9).stroke({ width: 1.4, color: 0x5a4632, alpha: 0.85 })
      g.poly([p.x, p.y - 9, p.x + 7, p.y - 6.8, p.x, p.y - 4.6]).fill({ color: 0xd95d2e, alpha: 0.9 })
    }
  }
  c.addChild(g)

  // a few small signs so the rope reads as a boundary, not decoration
  for (const [sx, sy, angle] of [
    [inset + 20, WORLD_H * 0.55, -90],
    [WORLD_W * 0.5, WORLD_H - inset - 12, 0],
    [WORLD_W - inset - 20, WORLD_H * 0.55, 90],
  ] as [number, number, number][]) {
    const label = new Text({
      text: 'SKI AREA BOUNDARY',
      style: { fontFamily: 'Instrument Sans, sans-serif', fontSize: 9, fontWeight: '700', fill: 0xd95d2e, letterSpacing: 1.5 },
    })
    label.alpha = 0.7
    label.anchor.set(0.5)
    label.position.set(sx, sy)
    label.angle = angle
    c.addChild(label)
  }
  return c
}

/** shortest signed angular difference a→b in radians */
function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

export interface SceneCallbacks {
  onSelect: (sel: Selection) => void
  onSlotClick: (slotId: string) => void
  onTrailClick: (trailId: string) => void
  onDrawPoint: (p: Vec2) => void
  onDrawFinish: () => void
  onLiftPoint: (p: Vec2) => void
}

export class MountainScene {
  app: Application
  world = new Container()
  private terrainSprite: Sprite | null = null
  private trailLayer = new Container()
  private liftLayer = new Container()
  private buildingLayer = new Container()
  private guestLayer = new Container()
  private villageLife = new Graphics()
  private rescueLayer = new Graphics()
  private lastVillageFrame = -1
  private weatherLayer = new Container()
  private previewLayer = new Container()
  private labelLayer = new Container()

  private guestViews = new Map<number, { sprite: Sprite; smooth: Vec2; heading: number }>()
  private chairSprites: { liftId: string; sprites: Sprite[] }[] = []
  private snowSprites: Sprite[] = []
  private dotTexture: Texture
  private flakeTexture: Texture
  private drawPreview = new Graphics()
  private previewLabel = new Text({
    text: '',
    style: {
      fontFamily: 'Instrument Sans, sans-serif',
      fontSize: 12,
      fontWeight: '700',
      fill: 0x16232b,
      stroke: { color: 0xffffff, width: 4 },
      lineHeight: 15,
    },
  })
  private mouseWorld: Vec2 | null = null

  private structureKey = ''
  private terrainKey = ''
  private callbacks: SceneCallbacks
  private getState: () => {
    game: GameState | null
    selection: Selection
    buildMode: BuildMode
    overlay: Overlay
  }

  // camera
  private zoom = 1
  private minZoom = 0.5
  private dragging = false
  private dragStart = { x: 0, y: 0 }
  private worldStart = { x: 0, y: 0 }
  private dragMoved = false
  private panKeys = new Set<string>()
  // touch: active pointers on the canvas; two at once is a pinch
  private touchPoints = new Map<number, { x: number; y: number }>()
  private pinchDist = 0
  private destroyed = false
  private onKeyDown = (e: KeyboardEvent) => this.handlePanKey(e, true)
  private onKeyUp = (e: KeyboardEvent) => this.handlePanKey(e, false)
  private onBlur = () => this.panKeys.clear()
  private onPointerMove = (e: PointerEvent) => {
    if (this.destroyed) return
    this.mouseWorld = this.toWorld(e)

    // two fingers down: pinch zoom toward the midpoint
    if (this.touchPoints.has(e.pointerId)) {
      this.touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (this.touchPoints.size === 2) {
        const [a, b] = [...this.touchPoints.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (this.pinchDist > 0 && d > 0) {
          const rect = (this.app.canvas as HTMLCanvasElement).getBoundingClientRect()
          this.zoomToward(d / this.pinchDist, {
            x: (a.x + b.x) / 2 - rect.left,
            y: (a.y + b.y) / 2 - rect.top,
          })
        }
        this.pinchDist = d
        return
      }
    }

    if (!this.dragging) return
    const dx = e.clientX - this.dragStart.x
    const dy = e.clientY - this.dragStart.y
    if (Math.abs(dx) + Math.abs(dy) > 6) this.dragMoved = true
    this.world.x = this.worldStart.x + dx
    this.world.y = this.worldStart.y + dy
    this.clampCamera()
  }
  private onPointerUp = (e: PointerEvent) => {
    if (this.destroyed) return
    if (this.touchPoints.delete(e.pointerId)) this.pinchDist = 0
    if (!this.dragging) return
    this.dragging = false
    if (!this.dragMoved) this.handleClick(e)
  }

  constructor(
    app: Application,
    getState: MountainScene['getState'],
    callbacks: SceneCallbacks,
  ) {
    this.app = app
    this.getState = getState
    this.callbacks = callbacks

    // drawPreview sits outside previewLayer: rebuilds destroy previewLayer's
    // children, but the draw-mode overlay is redrawn per frame instead
    this.world.addChild(this.trailLayer, this.liftLayer, this.buildingLayer, this.villageLife, this.guestLayer, this.rescueLayer, this.labelLayer, this.previewLayer, this.drawPreview, this.previewLabel, this.weatherLayer)
    this.previewLabel.visible = false
    app.stage.addChild(this.world)

    this.dotTexture = this.makeCircleTexture(5)
    this.flakeTexture = this.makeCircleTexture(2.4)

    this.fitCamera()
    this.bindInput()

    app.ticker.add(() => this.frame())
  }

  destroy(): void {
    this.destroyed = true
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    this.app.destroy(true, { children: true })
  }

  // ------------------------------------------------------------- camera

  fitCamera(): void {
    const w = this.app.renderer.width / this.app.renderer.resolution
    const h = this.app.renderer.height / this.app.renderer.resolution
    const fit = Math.max(w / WORLD_W, h / WORLD_H)
    // zooming all the way out shows the mountain plus the backcountry margin
    this.minZoom = Math.max(w / (WORLD_W + WORLD_PAD * 2), h / (WORLD_H + WORLD_PAD * 2))
    const framing = ACTIVE_MOUNTAIN.identity?.camera
    if (framing) {
      this.zoom = Math.max(this.minZoom, Math.min(w / framing.width, h / framing.height))
      this.world.scale.set(this.zoom)
      this.world.position.set(w / 2 - framing.center.x * this.zoom, h / 2 - framing.center.y * this.zoom)
      this.clampCamera()
      return
    }
    // …but open closer in, centred on the base village, so there's terrain
    // to pan across from the first moment
    this.zoom = fit * 1.35
    this.world.scale.set(this.zoom)
    const village = NODE_MAP.base ? { x: NODE_MAP.base.pos.x, y: NODE_MAP.base.pos.y - 40 } : { x: 950, y: 1000 }
    this.world.position.set(w / 2 - village.x * this.zoom, h - WORLD_H * this.zoom)
    this.clampCamera()
  }

  /** camera may roam into the painted out-of-bounds margin, never past it */
  private clampCamera(): void {
    const w = this.app.renderer.width / this.app.renderer.resolution
    const h = this.app.renderer.height / this.app.renderer.resolution
    const pad = WORLD_PAD * this.zoom
    const ww = WORLD_W * this.zoom + pad * 2
    const wh = WORLD_H * this.zoom + pad * 2
    this.world.x = ww <= w ? (w - ww) / 2 + pad : Math.min(pad, Math.max(w - WORLD_W * this.zoom - pad, this.world.x))
    this.world.y = wh <= h ? (h - wh) / 2 + pad : Math.min(pad, Math.max(h - WORLD_H * this.zoom - pad, this.world.y))
  }

  private bindInput(): void {
    const canvas = this.app.canvas as HTMLCanvasElement
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      this.zoomToward(e.deltaY < 0 ? 1.12 : 1 / 1.12, { x: e.clientX - rect.left, y: e.clientY - rect.top })
    }, { passive: false })

    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') {
        this.touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (this.touchPoints.size >= 2) {
          // second finger: this became a pinch, not a pan or a tap
          if (this.touchPoints.size === 2) {
            const [a, b] = [...this.touchPoints.values()]
            this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
          }
          this.dragging = false
          this.dragMoved = true
          return
        }
      }
      this.dragging = true
      this.dragMoved = false
      this.dragStart = { x: e.clientX, y: e.clientY }
      this.worldStart = { x: this.world.x, y: this.world.y }
    })
    // double-click ends the line being drawn
    canvas.addEventListener('dblclick', () => {
      if (this.getState().buildMode?.type === 'draw-trail') this.callbacks.onDrawFinish()
    })
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)

    // WASD / arrow-key panning, applied continuously in the frame loop
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
  }

  private static readonly PAN_KEYS: Record<string, string> = {
    w: 'up',
    a: 'left',
    s: 'down',
    d: 'right',
    arrowup: 'up',
    arrowleft: 'left',
    arrowdown: 'down',
    arrowright: 'right',
    '.': 'zoom-in',
    '/': 'zoom-out',
  }

  private handlePanKey(e: KeyboardEvent, down: boolean): void {
    if (down && (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) return
    if (down && (e.metaKey || e.ctrlKey || e.altKey)) return
    const dir = MountainScene.PAN_KEYS[e.key.toLowerCase()]
    if (!dir) return
    if (down) {
      this.panKeys.add(dir)
      e.preventDefault() // keep arrow keys from scrolling the page
    } else {
      this.panKeys.delete(dir)
    }
  }

  /** apply held pan/zoom keys; called every frame with the ticker's delta */
  private panCamera(deltaMS: number): void {
    if (this.panKeys.size === 0) return
    const step = 0.9 * deltaMS // screen px — steady speed regardless of zoom
    if (this.panKeys.has('up')) this.world.y += step
    if (this.panKeys.has('down')) this.world.y -= step
    if (this.panKeys.has('left')) this.world.x += step
    if (this.panKeys.has('right')) this.world.x -= step

    if (this.panKeys.has('zoom-in') || this.panKeys.has('zoom-out')) {
      const factor = this.panKeys.has('zoom-in') ? Math.pow(1.0042, deltaMS) : Math.pow(1.0042, -deltaMS)
      this.zoomToward(factor, null)
    }
    this.clampCamera()
  }

  /** zoom by a factor toward a screen point (null = viewport centre) */
  private zoomToward(factor: number, focus: { x: number; y: number } | null): void {
    const w = this.app.renderer.width / this.app.renderer.resolution
    const h = this.app.renderer.height / this.app.renderer.resolution
    const fx = focus?.x ?? w / 2
    const fy = focus?.y ?? h / 2
    const newZoom = Math.max(this.minZoom, Math.min(3.2, this.zoom * factor))
    const worldX = (fx - this.world.x) / this.zoom
    const worldY = (fy - this.world.y) / this.zoom
    this.zoom = newZoom
    this.world.scale.set(newZoom)
    this.world.x = fx - worldX * newZoom
    this.world.y = fy - worldY * newZoom
    this.clampCamera()
  }

  private toWorld(e: PointerEvent | MouseEvent): Vec2 {
    const rect = (this.app.canvas as HTMLCanvasElement).getBoundingClientRect()
    return {
      x: (e.clientX - rect.left - this.world.x) / this.zoom,
      y: (e.clientY - rect.top - this.world.y) / this.zoom,
    }
  }

  // ---------------------------------------------------------- hit testing

  private handleClick(e: PointerEvent): void {
    const { game, buildMode } = this.getState()
    if (!game) return
    const p = this.toWorld(e)

    // trail drawing: every click drops a waypoint
    if (buildMode?.type === 'draw-trail') {
      this.callbacks.onDrawPoint(p)
      return
    }

    // build mode: clicks target the relevant ghost sites
    if (buildMode?.type === 'facility') {
      const slot = this.nearestFreeSlot(game, p, buildMode.kind)
      if (slot) {
        this.callbacks.onSlotClick(slot)
        return
      }
    }
    if (buildMode?.type === 'draw-lift') {
      this.callbacks.onLiftPoint(p)
      return
    }
    if (buildMode?.type === 'trail' || buildMode?.type === 'snowmaking') {
      const trailId = this.nearestTrail(game, p, 34)
      if (trailId) {
        this.callbacks.onTrailClick(trailId)
        return
      }
    }

    // selection: guest → facility → lift → trail
    const guestId = this.nearestGuest(game, p, 10)
    if (guestId !== null) {
      this.callbacks.onSelect({ type: 'guest', id: guestId })
      return
    }
    const slotId = this.nearestBuiltSlot(game, p, 30)
    if (slotId) {
      this.callbacks.onSelect({ type: 'facility', id: slotId })
      return
    }
    const lift = this.nearestLiftSite(game, p, 22)
    if (lift) {
      this.callbacks.onSelect({ type: 'lift', id: lift })
      return
    }
    const trailId = this.nearestTrail(game, p, 26)
    if (trailId && game.trails[trailId].built) {
      this.callbacks.onSelect({ type: 'trail', id: trailId })
      return
    }
    this.callbacks.onSelect(null)
  }

  private nearestGuest(game: GameState, p: Vec2, radius: number): number | null {
    let best: number | null = null
    let bestD = radius
    for (const g of Object.values(game.guests)) {
      const d = Math.hypot(g.pos.x - p.x, g.pos.y - p.y)
      if (d < bestD) {
        bestD = d
        best = g.id
      }
    }
    return best
  }

  private nearestFreeSlot(game: GameState, p: Vec2, kind: string): string | null {
    let best: string | null = null
    let bestD = 46
    for (const slot of FACILITY_SLOTS) {
      if (game.facilities[slot.id]) continue
      const allowed = slot.allowed === 'any-village' ? kind !== 'parking' : slot.allowed.includes(kind as never)
      if (!allowed) continue
      const d = Math.hypot(slot.pos.x - p.x, slot.pos.y - p.y)
      if (d < bestD) {
        bestD = d
        best = slot.id
      }
    }
    return best
  }

  private nearestBuiltSlot(game: GameState, p: Vec2, radius: number): string | null {
    let best: string | null = null
    let bestD = radius
    for (const slot of FACILITY_SLOTS) {
      if (!game.facilities[slot.id]) continue
      const d = Math.hypot(slot.pos.x - p.x, slot.pos.y - p.y)
      if (d < bestD) {
        bestD = d
        best = slot.id
      }
    }
    return best
  }

  private nearestLiftSite(game: GameState, p: Vec2, threshold: number): string | null {
    let best: string | null = null
    let bestD = threshold
    for (const lift of Object.values(game.lifts)) {
      if (!getLiftSite(game, lift.siteId)) continue
      const d = distToMeasured(p, getLiftLine(game, lift.siteId))
      if (d < bestD) {
        bestD = d
        best = lift.siteId
      }
    }
    return best
  }

  private nearestTrail(game: GameState, p: Vec2, threshold: number): string | null {
    let best: string | null = null
    let bestD = threshold
    for (const def of allTrailDefs(game)) {
      const d = distToMeasured(p, getTrailPath(game, def.id))
      if (d < bestD) {
        bestD = d
        best = def.id
      }
    }
    return best
  }

  // ---------------------------------------------------------- frame loop

  private frame(): void {
    this.panCamera(this.app.ticker.deltaMS)

    const { game, selection, buildMode, overlay } = this.getState()
    if (!game) return
    ensureMountain(game.mountainId, game.mountainVersion ?? 1)

    // terrain mood repaint (rare)
    const weather = game.weatherSeason[game.day - 1]
    const tKey = `${game.mountainId}|${game.day}|${weather.cloud.toFixed(2)}|${weather.visibility.toFixed(2)}|${Object.keys(game.customTrailDefs).length}|${Object.keys(game.customLiftSites).length}`
    if (tKey !== this.terrainKey) {
      this.terrainKey = tKey
      const canvas = paintTerrain(moodFromWeather(weather), game.seed, builtClearings(game))
      const texture = Texture.from(canvas)
      if (this.terrainSprite) {
        const old = this.terrainSprite.texture
        this.terrainSprite.texture = texture
        old.destroy(true)
      } else {
        this.terrainSprite = new Sprite(texture)
        this.terrainSprite.position.set(-WORLD_PAD, -WORLD_PAD)
        this.world.addChildAt(this.terrainSprite, 0)
        this.world.addChildAt(makeBoundary(), 1)
      }
    }

    // structural rebuild (rare)
    const sKey = structureKeyOf(game, selection, buildMode, overlay) + JSON.stringify(game.style)
    if (sKey !== this.structureKey) {
      this.structureKey = sKey
      this.rebuildStatic(game, selection, buildMode, overlay)
    }

    const dark = darkness(game)
    if (this.terrainSprite) {
      const mix = (day: number, night: number) => Math.round(day + (night - day) * dark)
      this.terrainSprite.tint = (mix(255, 84) << 16) | (mix(255, 108) << 8) | mix(255, 151)
    }
    const villageTime = Math.floor(performance.now() / 100)
    if (villageTime !== this.lastVillageFrame) {
      this.lastVillageFrame = villageTime
      paintVillageLife(this.villageLife, game, villageTime / 10)
    }
    paintRescues(this.rescueLayer, game, window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    this.updateGuests(game)
    this.updateChairs(game)
    this.updateWeather(game)
    this.updateDrawPreview(game, buildMode)
  }

  /** live overlay while drawing a trail or placing a lift */
  private updateDrawPreview(game: GameState, buildMode: BuildMode): void {
    const g = this.drawPreview
    g.clear()
    this.previewLabel.visible = false
    if (buildMode?.type !== 'draw-trail' && buildMode?.type !== 'draw-lift') return

    const nodes = allNodes(game)

    // snap rings on network nodes — endpoints want to live here
    for (const node of nodes) {
      g.circle(node.pos.x, node.pos.y, 10).stroke({ width: 2, color: 0xa97949, alpha: 0.55 })
      g.circle(node.pos.x, node.pos.y, 3).fill({ color: 0xa97949, alpha: 0.7 })
    }
    // cursor snapping hint: nodes first, else onto a built trail (fork/merge)
    if (this.mouseWorld) {
      const snap = nearestNodeId(this.mouseWorld, undefined, nodes)
      if (snap) {
        const node = nodes.find((n) => n.id === snap)!
        g.circle(node.pos.x, node.pos.y, 14).stroke({ width: 2.5, color: 0x2e7d4f, alpha: 0.9 })
      } else if (buildMode.type === 'draw-trail') {
        const onTrail = nearestOnTrail(game, this.mouseWorld)
        if (onTrail) {
          g.circle(onTrail.pos.x, onTrail.pos.y, 9).stroke({ width: 2.5, color: 0x2e7d4f, alpha: 0.9 })
          g.circle(onTrail.pos.x, onTrail.pos.y, 2.5).fill({ color: 0x2e7d4f, alpha: 0.9 })
        }
      }
    }

    if (buildMode.type === 'draw-trail') {
      const committed = buildMode.points
      const preview = this.mouseWorld && !this.dragging ? [...committed, this.mouseWorld] : committed

      if (preview.length >= 2) {
        const analysis = analyzePath(preview, nodes)
        // ribbon ghost, centerline tinted by the grade this line would earn
        const ghost = roundedPoints(preview)
        strokePath(g, ghost, 15, 0xffffff, 0.55)
        strokePath(g, ghost, 3, DIFF_COLOR[analysis.difficulty] ?? 0x2f6fb2, 0.9)
        if (analysis.uphillSegments.length > 0) {
          const mp = measurePath(preview)
          for (const seg of analysis.uphillSegments) {
            const steps = 8
            for (let i = 0; i < steps; i++) {
              const a = pointAt(mp, seg.t0 + ((seg.t1 - seg.t0) * i) / steps)
              const b = pointAt(mp, seg.t0 + ((seg.t1 - seg.t0) * (i + 1)) / steps)
              g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 6, color: 0xd95d2e, alpha: 0.85 })
            }
          }
        }
      }
      // committed waypoints
      for (const p of committed) {
        g.circle(p.x, p.y, 4.5).fill({ color: 0x2f6fb2 })
        g.circle(p.x, p.y, 2).fill({ color: 0xffffff })
      }
      return
    }

    // ---- draw-lift: ghost cable from the first terminal to the cursor
    const first = buildMode.first
    if (first) {
      g.circle(first.x, first.y, 6).fill({ color: 0xa97949 })
      g.circle(first.x, first.y, 2.5).fill({ color: 0xffffff })
    }
    const cursor = this.mouseWorld
    if (first && cursor && !this.dragging) {
      const snap = nearestNodeId(cursor, undefined, nodes)
      const end = snap ? nodes.find((n) => n.id === snap)!.pos : cursor
      dashPath(g, measurePath([first, end]), 10, 8, 2.5, 0xa97949, 0.95)
      // tower ticks along the ghost
      const mp = measurePath([first, end])
      const towers = Math.max(2, Math.floor(mp.total / 90))
      for (let i = 1; i < towers; i++) {
        const q = pointAt(mp, i / towers)
        g.moveTo(q.x, q.y).lineTo(q.x, q.y + 8).stroke({ width: 2.5, color: 0xa97949, alpha: 0.7 })
      }
      g.roundRect(end.x - 7, end.y - 5, 14, 10, 3).stroke({ width: 2, color: 0xa97949, alpha: 0.9 })

      // live cost readout riding beside the cursor
      const plan = planCustomLift(game, first, end, buildMode.kind)
      this.previewLabel.text =
        `${plan.lengthM.toLocaleString()} m · ↑${plan.riseM} m\n` +
        `${plan.treesToClear} trees · $${plan.totalCost.toLocaleString()}` +
        (ACTIVE_MOUNTAIN.identity ? `\nWind on line: ${Math.round(game.weatherSeason[game.day - 1].windKph * routeWindMultiplier([plan.bottom, plan.top]))} km/h today` : '') +
        (plan.warnings.length > 0 ? `\n⚠ ${plan.warnings.length} warning${plan.warnings.length > 1 ? 's' : ''}` : '')
      this.previewLabel.position.set(end.x + 16, end.y - 10)
      this.previewLabel.visible = true
    }
  }

  // ------------------------------------------------------ static rebuild

  private rebuildStatic(game: GameState, selection: Selection, buildMode: BuildMode, overlay: Overlay): void {
    this.trailLayer.removeChildren().forEach((c) => c.destroy({ children: true }))
    this.liftLayer.removeChildren().forEach((c) => c.destroy({ children: true }))
    this.buildingLayer.removeChildren().forEach((c) => c.destroy({ children: true }))
    this.previewLayer.removeChildren().forEach((c) => c.destroy({ children: true }))
    this.labelLayer.removeChildren().forEach((c) => c.destroy({ children: true }))
    this.chairSprites = []

    this.drawTrails(game, selection, buildMode, overlay)
    this.drawLifts(game, selection, buildMode)
    this.drawBuildings(game, selection, buildMode)
    for (const form of ACTIVE_MOUNTAIN.identity?.landforms ?? []) {
      const label = new Text({ text: form.name,
        style: { fontFamily: 'Fraunces, serif', fontSize: 17, fontStyle: 'italic', fill: 0x496575,
          stroke: { color: 0xf3f7f9, width: 4 } } })
      label.anchor.set(0.5)
      label.position.set(form.center.x, form.center.y - form.radius.y * 0.55)
      this.labelLayer.addChild(label)
    }
  }

  private drawTrails(game: GameState, selection: Selection, buildMode: BuildMode, overlay: Overlay): void {
    for (const def of allTrailDefs(game)) {
      const st = game.trails[def.id]
      if (!st) continue // custom def without state shouldn't happen, but be safe
      const mp = getTrailPath(game, def.id)
      const g = new Graphics()
      const width = Math.max(10, def.widthM * 0.55)

      if (st.built) {
        const ribbonColor = overlayTrailColor(overlay, st, def)
        const ribbon = roundedPoints(mp.points, Math.max(12, width * 0.6))
        // carved-edge shadow so the piste reads against open snowfield
        strokePath(g, ribbon, width + 5, 0x9db4c4, st.open ? 0.5 : 0.3)
        // ribbon
        strokePath(g, ribbon, width, st.open ? ribbonColor.color : 0xdde3e8, st.open ? ribbonColor.alpha : 0.75)
        // difficulty edges, both sides
        strokePath(g, ribbon, 2.2, DIFF_COLOR[def.difficulty], st.open ? 0.9 : 0.35, width / 2 + 2)
        strokePath(g, ribbon, 2.2, DIFF_COLOR[def.difficulty], st.open ? 0.9 : 0.35, -(width / 2 + 2))
        if (!st.open) {
          // closed: crosshatch ropes
          const mid = pointAt(mp, 0.08)
          g.circle(mid.x, mid.y, 8).fill({ color: 0xd95d2e, alpha: 0.95 })
          g.moveTo(mid.x - 4, mid.y - 4).lineTo(mid.x + 4, mid.y + 4).stroke({ width: 2.4, color: 0xffffff })
          g.moveTo(mid.x + 4, mid.y - 4).lineTo(mid.x - 4, mid.y + 4).stroke({ width: 2.4, color: 0xffffff })
        }
        // Surfaces stay legible in the natural view. Tracks accumulate in
        // bounded batches, avoiding a static scene rebuild for every skier.
        if (overlay === 'none') {
          const marks = st.surface === 'thin' ? 14 : st.surface === 'icy' ? 12 : Math.min(18, Math.floor(st.traffic / 5))
          for (let i = 0; i < marks; i++) {
            const t = (i + 1) / (marks + 1)
            const a = pointAt(mp, Math.max(0, t - 0.007))
            const b = pointAt(mp, Math.min(1, t + 0.012))
            const offset = (hashNoise(game.seed, i, 621) - 0.5) * width * 0.55
            const color = st.surface === 'thin' ? 0x9d8b70 : st.surface === 'icy' ? 0x8bc4df : 0x9ab6c8
            g.moveTo(a.x + offset, a.y).lineTo(b.x + offset, b.y).stroke({ width: st.surface === 'thin' ? 3 : 1.4, color, alpha: 0.7 })
          }
        }
        // Corduroy follows the piste, across the full route.
        if (st.surface === 'groomed' && st.open) {
          const count = Math.min(120, Math.floor(mp.total / 10))
          for (let i = 1; i < count; i++) {
            const q = pointAt(mp, i / count), next = pointAt(mp, Math.min(1, i / count + 0.005))
            const len = Math.hypot(next.x - q.x, next.y - q.y) || 1
            const nx = -(next.y - q.y) / len * width * 0.35, ny = (next.x - q.x) / len * width * 0.35
            g.moveTo(q.x - nx, q.y - ny).lineTo(q.x + nx, q.y + ny).stroke({ width: 0.8, color: 0xbfd2de, alpha: 0.6 })
          }
        }
      } else {
        // unbuilt corridor ghost
        const isTarget = buildMode?.type === 'trail'
        dashPath(g, mp, 8, 7, isTarget ? 3 : 1.6, isTarget ? 0x2f6fb2 : 0x9db4c2, isTarget ? 0.95 : 0.55)
      }

      // selection halo
      if (selection?.type === 'trail' && selection.id === def.id) {
        strokePath(g, roundedPoints(mp.points, Math.max(12, width * 0.6)), width + 8, 0xe8b26a, 0.35)
      }
      // snowmaking badge
      if (st.hasSnowmaking && st.built) {
        const q = pointAt(mp, 0.85)
        g.circle(q.x + width / 2 + 8, q.y, 4.5).fill({ color: 0x2f6fb2, alpha: 0.9 })
        g.circle(q.x + width / 2 + 8, q.y, 2).fill({ color: 0xffffff })
      }
      this.trailLayer.addChild(g)

      // difficulty marker + name at the top of built trails
      if (st.built) {
        const top = mp.points[0]
        this.labelLayer.addChild(makeDiffBadge(def.difficulty, top.x - 14, top.y - 4))
        const label = new Text({
          text: def.name,
          style: {
            fontFamily: 'Instrument Sans, sans-serif',
            fontSize: 11,
            fontWeight: '600',
            fill: 0x3d5260,
            stroke: { color: 0xffffff, width: 3 },
          },
        })
        label.position.set(top.x - 6, top.y - 12)
        this.labelLayer.addChild(label)
      }
    }

    // junction markers: where lines cross or fork, skiers pick their way
    const jg = new Graphics()
    for (const junction of Object.values(game.junctions)) {
      const node = game.customNodes[junction.nodeId]
      if (!node) continue
      jg.circle(node.pos.x, node.pos.y, 6).fill({ color: 0xfbfdfe, alpha: 0.95 })
      jg.circle(node.pos.x, node.pos.y, 6).stroke({ width: 2, color: 0x5a4632, alpha: 0.85 })
      jg.circle(node.pos.x, node.pos.y, 2).fill({ color: 0x5a4632, alpha: 0.9 })
    }
    this.trailLayer.addChild(jg)
  }

  private drawLifts(game: GameState, selection: Selection, _buildMode: BuildMode): void {
    // every built lift, surveyed or player-placed — lifts go anywhere now
    for (const lift of Object.values(game.lifts)) {
      const site = getLiftSite(game, lift.siteId)
      if (!site) continue
      const mp = getLiftLine(game, site.id)
      const a = mp.points[0]
      const b = mp.points[mp.points.length - 1]
      const g = new Graphics()

      const running = isLiftRunning(game, site.id)
      const lineColor = lift.forcedClosed ? 0xb3543a : running ? 0x37474f : 0x8fa0aa

      // towers
      const towers = Math.max(2, Math.floor(mp.total / 90))
      for (let i = 1; i < towers; i++) {
        const q = pointAt(mp, i / towers)
        g.moveTo(q.x, q.y).lineTo(q.x, q.y + 9).stroke({ width: 3, color: 0x4a5a63, alpha: 0.9 })
      }
      // cable (double line)
      strokePath(g, mp.points, 1.6, lineColor, 0.95, -2)
      strokePath(g, mp.points, 1.6, lineColor, 0.7, 2)

      // terminals
      for (const p of [a, b]) {
        g.roundRect(p.x - 7, p.y - 5, 14, 10, 3).fill({ color: 0x37474f })
        g.roundRect(p.x - 7, p.y - 5, 14, 4, 2).fill({ color: lift.kind === 'gondola' ? 0xa8412f : 0x546e7a })
      }
      // status dot at base terminal
      g.circle(a.x + 10, a.y - 8, 4).fill({ color: lift.forcedClosed ? 0xd95d2e : running ? 0x2e7d4f : 0x9aa7b0 })

      if (selection?.type === 'lift' && selection.id === site.id) {
        strokePath(g, mp.points, 10, 0xe8b26a, 0.3)
      }
      this.liftLayer.addChild(g)

      // chairs (animated in frame loop)
      const chairCount = lift.kind === 'gondola' ? 6 : lift.kind === 'surface' ? 0 : 8
      const sprites: Sprite[] = []
      for (let i = 0; i < chairCount; i++) {
        const s = new Sprite(this.dotTexture)
        s.anchor.set(0.5)
        s.tint = lift.kind === 'gondola' ? 0xa8412f : 0x455a64
        s.scale.set(lift.kind === 'gondola' ? 1.15 : 0.8)
        this.liftLayer.addChild(s)
        sprites.push(s)
      }
      this.chairSprites.push({ liftId: site.id, sprites })

      // name label
      const label = new Text({
        text: site.name,
        style: { fontFamily: 'Instrument Sans, sans-serif', fontSize: 11, fontWeight: '600', fill: 0x37474f, stroke: { color: 0xffffff, width: 3 } },
      })
      label.anchor.set(0.5, 1)
      label.position.set((a.x + b.x) / 2, (a.y + b.y) / 2 - 6)
      label.angle = 0
      this.labelLayer.addChild(label)
    }
  }

  private drawBuildings(game: GameState, selection: Selection, buildMode: BuildMode): void {
    for (const slot of FACILITY_SLOTS) {
      const kind = game.facilities[slot.id]
      const { x, y } = slot.pos

      if (!kind) {
        // empty slot ghost while placing facilities
        if (buildMode?.type === 'facility') {
          const want = buildMode.kind
          const ok = slot.allowed === 'any-village' ? want !== 'parking' : slot.allowed.includes(want)
          if (ok) {
            const g = new Graphics()
            g.roundRect(x - 20, y - 16, 40, 26, 5).stroke({ width: 2, color: 0x2e7d4f, alpha: 0.9 })
            g.roundRect(x - 20, y - 16, 40, 26, 5).fill({ color: 0x2e7d4f, alpha: 0.12 })
            g.moveTo(x - 6, y - 3).lineTo(x + 6, y - 3).stroke({ width: 2, color: 0x2e7d4f })
            g.moveTo(x, y - 9).lineTo(x, y + 3).stroke({ width: 2, color: 0x2e7d4f })
            this.buildingLayer.addChild(g)
          }
        }
        continue
      }

      this.buildingLayer.addChild(makeBuilding(kind, x, y, selection?.type === 'facility' && selection.id === slot.id))
    }
  }

  // ------------------------------------------------------ per-frame bits

  private updateGuests(game: GameState): void {
    const seen = new Set<number>()
    const t = performance.now() / 1000
    for (const guest of Object.values(game.guests)) {
      seen.add(guest.id)
      let view = this.guestViews.get(guest.id)
      if (!view) {
        const sprite = new Sprite()
        sprite.anchor.set(0.5)
        sprite.scale.set(0.115)
        sprite.position.set(guest.pos.x, guest.pos.y)
        this.guestLayer.addChild(sprite)
        view = { sprite, smooth: { ...guest.pos }, heading: Math.PI / 2 }
        this.guestViews.set(guest.id, view)
      }
      const { sprite } = view
      const look = guestLook(guest.id)
      const phase = (guest.id % 17) * 0.7

      // smooth base position toward the sim
      view.smooth.x += (guest.pos.x - view.smooth.x) * 0.22
      view.smooth.y += (guest.pos.y - view.smooth.y) * 0.22

      const skiing = guest.objective === 'skiing'
      const hiking = skiing && guest.stuckSegIdx >= 0

      // travel heading from smoothed motion (kept when stationary)
      const dx = guest.pos.x - view.smooth.x
      const dy = guest.pos.y - view.smooth.y
      if (Math.hypot(dx, dy) > 0.35) {
        const target = Math.atan2(dy, dx)
        view.heading += angleDelta(view.heading, target) * 0.18
      }

      if (skiing && !hiking) {
        // carve: pose leans through an S-turn cycle; the body sways across
        // the fall line so the track reads as linked turns
        const isBoard = look.rides === 'board'
        const cycle = Math.sin(t * (isBoard ? 2.2 : 2.9) + phase)
        const pose = Math.round(cycle * 2)
        const swayAmp = isBoard ? 3.4 : 2.4
        const px = -Math.sin(view.heading) * cycle * swayAmp
        const py = Math.cos(view.heading) * cycle * swayAmp
        sprite.texture = guestTexture(look.rides, pose, look.palette)
        sprite.rotation = view.heading - Math.PI / 2
        sprite.position.set(view.smooth.x + px, view.smooth.y + py)
      } else if (hiking) {
        // stuck on an uphill stretch: upright, trudging
        sprite.texture = guestTexture('stand', 0, look.palette)
        sprite.rotation = 0
        sprite.position.set(view.smooth.x, view.smooth.y + Math.sin(t * 6 + phase) * 0.5)
      } else {
        // village life: upright figure with a little walking bob
        const moving =
          guest.objective === 'walking' ||
          guest.objective === 'arriving' ||
          guest.objective === 'leaving' ||
          guest.objective === 'to-lift'
        sprite.texture = guestTexture('stand', 0, look.palette)
        sprite.rotation = 0
        sprite.position.set(view.smooth.x, view.smooth.y + (moving ? Math.sin(t * 9 + phase) * 0.6 : 0))
      }

      // hide guests inside buildings; riders are represented by their chair
      const hidden =
        guest.objective === 'rescue' ||
        guest.objective === 'riding' ||
        guest.objective === 'eating' ||
        guest.objective === 'resting' ||
        guest.objective === 'restroom' ||
        guest.objective === 'first-aid' ||
        guest.objective === 'buying-ticket' ||
        guest.objective === 'renting'
      sprite.alpha = hidden ? 0 : 1
    }
    for (const [id, view] of this.guestViews) {
      if (!seen.has(id)) {
        view.sprite.destroy()
        this.guestViews.delete(id)
      }
    }
  }

  private updateChairs(game: GameState): void {
    const t = performance.now() / 1000
    for (const { liftId, sprites } of this.chairSprites) {
      const lift = game.lifts[liftId]
      if (!lift) continue
      const mp = getLiftLine(game, liftId)
      const running = isLiftRunning(game, liftId) && game.phase === 'operating'
      const cycleSec = Math.max(20, lift.rideMinutes * 14) // aesthetic speed, not 1:1 sim
      for (let i = 0; i < sprites.length; i++) {
        const phase = (i / sprites.length + (running ? t / cycleSec : 0)) % 1
        const up = i % 2 === 0
        const q = pointAt(mp, up ? phase : 1 - phase)
        // offset the two directions to suggest a return line
        const dx = mp.points[1].x - mp.points[0].x
        const dy = mp.points[1].y - mp.points[0].y
        const len = Math.hypot(dx, dy) || 1
        const ox = (-dy / len) * (up ? 2.4 : -2.4)
        const oy = (dx / len) * (up ? 2.4 : -2.4)
        sprites[i].position.set(q.x + ox, q.y + oy)
        sprites[i].alpha = lift.forcedClosed ? 0.35 : 0.95
      }
    }
  }

  private updateWeather(game: GameState): void {
    const weather = game.weatherSeason[game.day - 1]
    const targetFlakes = weather.snowfallCm > 0 ? Math.min(340, 60 + weather.snowfallCm * 12) : 0

    while (this.snowSprites.length < targetFlakes) {
      const s = new Sprite(this.flakeTexture)
      s.anchor.set(0.5)
      s.tint = 0xffffff
      s.alpha = 0.5 + hashNoise(1, this.snowSprites.length, 5) * 0.4
      s.position.set(hashNoise(2, this.snowSprites.length, 6) * WORLD_W, hashNoise(3, this.snowSprites.length, 7) * WORLD_H)
      ;(s as Sprite & { vy: number; vx: number }).vy = 0.6 + hashNoise(4, this.snowSprites.length, 8) * 1.2
      ;(s as Sprite & { vy: number; vx: number }).vx = (weather.windKph / 60) * (0.4 + hashNoise(5, this.snowSprites.length, 9))
      this.weatherLayer.addChild(s)
      this.snowSprites.push(s)
    }
    while (this.snowSprites.length > targetFlakes) {
      const s = this.snowSprites.pop()!
      s.destroy()
    }
    for (const s of this.snowSprites) {
      const sv = s as Sprite & { vy: number; vx: number }
      s.y += sv.vy
      s.x += sv.vx
      if (s.y > WORLD_H) s.y = -4
      if (s.x > WORLD_W) s.x = 0
      if (s.x < 0) s.x = WORLD_W
    }
  }

  private makeCircleTexture(radius: number): Texture {
    // darker rim tints to a deep shade of the sprite tint — free outline
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = radius * 2 + 4
    const ctx = canvas.getContext('2d')!
    const c = radius + 2
    ctx.fillStyle = 'rgb(120,120,120)'
    ctx.beginPath()
    ctx.arc(c, c, radius + 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(c, c, radius - 0.5, 0, Math.PI * 2)
    ctx.fill()
    return Texture.from(canvas)
  }
}

// ------------------------------------------------------------------ utils

function distToMeasured(p: Vec2, mp: { points: Vec2[] }): number {
  let best = Infinity
  const pts = mp.points
  for (let i = 1; i < pts.length; i++) {
    const x0 = pts[i - 1].x
    const y0 = pts[i - 1].y
    const dx = pts[i].x - x0
    const dy = pts[i].y - y0
    const lenSq = dx * dx + dy * dy
    let t = lenSq === 0 ? 0 : ((p.x - x0) * dx + (p.y - y0) * dy) / lenSq
    t = Math.max(0, Math.min(1, t))
    best = Math.min(best, Math.hypot(p.x - (x0 + dx * t), p.y - (y0 + dy * t)))
  }
  return best
}

/**
 * Rendering-only corner rounding: replace each interior vertex with a short
 * sampled quadratic so drawn runs read as carved turns, not sawteeth. The
 * sim, hit-testing, and junction geometry all stay on the true polyline —
 * deviation is bounded by `radius` world units at the corners.
 */
function roundedPoints(pts: Vec2[], radius = 14): Vec2[] {
  if (pts.length <= 2) return pts
  const out: Vec2[] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]
    const a = pts[i - 1]
    const b = pts[i + 1]
    const la = Math.hypot(p.x - a.x, p.y - a.y) || 1
    const lb = Math.hypot(b.x - p.x, b.y - p.y) || 1
    const ra = Math.min(radius, la * 0.45)
    const rb = Math.min(radius, lb * 0.45)
    const pin = { x: p.x - ((p.x - a.x) / la) * ra, y: p.y - ((p.y - a.y) / la) * ra }
    const pout = { x: p.x + ((b.x - p.x) / lb) * rb, y: p.y + ((b.y - p.y) / lb) * rb }
    for (let s = 0; s <= 4; s++) {
      const t = s / 4
      const u = 1 - t
      out.push({
        x: u * u * pin.x + 2 * u * t * p.x + t * t * pout.x,
        y: u * u * pin.y + 2 * u * t * p.y + t * t * pout.y,
      })
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

/** stroke a polyline, optionally offset perpendicular by `offset` */
function strokePath(g: Graphics, pts: Vec2[], width: number, color: number, alpha: number, offset = 0): void {
  const off = (i: number): Vec2 => {
    if (offset === 0) return pts[i]
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    return { x: pts[i].x + (-dy / len) * offset, y: pts[i].y + (dx / len) * offset }
  }
  const p0 = off(0)
  g.moveTo(p0.x, p0.y)
  for (let i = 1; i < pts.length; i++) {
    const p = off(i)
    g.lineTo(p.x, p.y)
  }
  g.stroke({ width, color, alpha, cap: 'round', join: 'round' })
}

function dashPath(g: Graphics, mp: { points: Vec2[]; cum: number[]; total: number }, dash: number, gap: number, width: number, color: number, alpha: number): void {
  let d = 0
  while (d < mp.total) {
    const t0 = d / mp.total
    const t1 = Math.min(1, (d + dash) / mp.total)
    const a = pointAt(mp as never, t0)
    const b = pointAt(mp as never, t1)
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width, color, alpha, cap: 'round' })
    d += dash + gap
  }
}

function overlayTrailColor(overlay: Overlay, st: TrailState, def: TrailDef): { color: number; alpha: number } {
  switch (overlay) {
    case 'difficulty':
      return { color: DIFF_COLOR[def.difficulty], alpha: 0.55 }
    case 'snow': {
      const depth = Math.min(1, st.snowDepthCm / 100)
      // thin = warm alarm, deep = rich blue
      const color = depth < 0.3 ? 0xd95d2e : depth < 0.55 ? 0x7fa8c9 : 0x2f6fb2
      return { color, alpha: 0.6 }
    }
    case 'crowding': {
      const load = st.skierIds.length / def.capacity
      const color = load > 0.85 ? 0xc0392b : load > 0.5 ? 0xd9913d : 0x2e7d4f
      return { color, alpha: 0.55 }
    }
    default:
      return { color: 0xfbfdfe, alpha: 0.92 }
  }
}

function makeDiffBadge(difficulty: string, x: number, y: number): Graphics {
  const g = new Graphics()
  const c = DIFF_COLOR[difficulty]
  if (difficulty === 'green') {
    g.circle(x, y, 5).fill({ color: c })
  } else if (difficulty === 'blue') {
    g.rect(x - 4.5, y - 4.5, 9, 9).fill({ color: c })
  } else if (difficulty === 'black') {
    g.poly([x, y - 6, x + 5, y, x, y + 6, x - 5, y]).fill({ color: c })
  } else {
    g.poly([x - 3, y - 6, x + 2, y, x - 3, y + 6, x - 8, y]).fill({ color: c })
    g.poly([x + 5, y - 6, x + 10, y, x + 5, y + 6, x, y]).fill({ color: c })
  }
  g.circle(x, y, 0.1) // keep bounds sane
  return g
}

function makeBuilding(kind: string, x: number, y: number, selected: boolean): Container {
  const c = new Container()
  const g = new Graphics()
  const spec = FACILITIES[kind as keyof typeof FACILITIES]
  const biome = ACTIVE_MOUNTAIN.identity?.biome

  const big = kind === 'base-lodge' || kind === 'restaurant'
  const w = big ? 46 : kind === 'parking' ? 54 : 32
  const h = big ? 24 : kind === 'parking' ? 26 : 17

  if (kind === 'parking') {
    g.roundRect(x - w / 2, y - h / 2, w, h, 4).fill({ color: 0x6b7a85, alpha: 0.85 })
    g.roundRect(x - w / 2, y - h / 2, w, h, 4).stroke({ width: 1.5, color: 0x4a5a63 })
    for (let i = 0; i < 4; i++) {
      g.moveTo(x - w / 2 + 8 + i * 11, y - h / 2 + 4).lineTo(x - w / 2 + 8 + i * 11, y + h / 2 - 4).stroke({ width: 1.2, color: 0xdde3e8, alpha: 0.7 })
    }
  } else {
    // shadow
    g.ellipse(x + 3, y + h / 2 + 2, w * 0.55, 4).fill({ color: 0x788fa0, alpha: 0.3 })
    // walls (wood)
    const walls: Record<string, number> = { hardwood: 0xa34e40, birch: 0x485962, tussock: 0x8d795f, granite: 0x8e4244, fir: 0x785b3c, aspen: 0xa18154, limestone: 0x6f7e8b, glacier: 0xd9c7aa }
    const wall = biome ? walls[biome] : 0x9c7a52
    g.roundRect(x - w / 2, y - h / 2 + 3, w, h - 3, 2).fill({ color: kind === 'first-aid' || kind === 'patrol-hq' ? 0xf4f6f8 : wall })
    // roof (snowy gable)
    g.poly([x - w / 2 - 4, y - h / 2 + 6, x, y - h / 2 - 8, x + w / 2 + 4, y - h / 2 + 6]).fill({ color: 0xf2f6f9 })
    g.poly([x - w / 2 - 4, y - h / 2 + 6, x, y - h / 2 - 8, x + w / 2 + 4, y - h / 2 + 6]).stroke({ width: 1.4, color: 0x8fa0aa })
    // door
    g.roundRect(x - 3, y + h / 2 - 8, 6, 8, 1).fill({ color: 0x5b4632 })
    if (biome) {
      // Windows, distinct eaves and entrance equipment give functional scale.
      for (const side of [-1, 1]) {
        g.rect(x + side * w * 0.29 - 3, y - 3, 6, 5).fill({ color: biome === 'birch' ? 0xffd28b : 0xc5e0e5 })
      }
      if (biome === 'birch') {
        g.moveTo(x - w / 2 - 5, y - h / 2 + 6).lineTo(x + w / 2 + 5, y - h / 2 + 6).stroke({ width: 3, color: 0xfafcff })
        g.circle(x + w / 2 + 3, y + 3, 3).fill({ color: 0xd95b4a })
      } else if (biome === 'hardwood') {
        g.rect(x - w / 2 + 4, y - h / 2 - 10, 5, 9).fill({ color: 0x695c54 })
      } else {
        g.moveTo(x - w / 2 - 4, y - h / 2 + 6).lineTo(x + w / 2 + 4, y - h / 2 + 6).stroke({ width: 3, color: 0x576f76 })
      }
      if (kind === 'base-lodge' || kind === 'rental-shop') {
        g.moveTo(x - 20, y + h / 2 + 6).lineTo(x - 7, y + h / 2 + 6).stroke({ width: 2, color: 0x766859 })
        for (let i = 0; i < 4; i++) g.moveTo(x - 20 + i * 3, y + h / 2 + 9).lineTo(x - 18 + i * 3, y + h / 2).stroke({ width: 1.4, color: i % 2 ? 0xc76545 : 0x4f8195 })
      }
    }
    // patrol/first-aid cross
    if (kind === 'first-aid' || kind === 'patrol-hq') {
      g.rect(x - 8, y - 3, 16, 4).fill({ color: 0xc0392b })
      g.rect(x - 2, y - 9, 4, 16).fill({ color: 0xc0392b })
    }
  }
  if (selected) {
    g.roundRect(x - w / 2 - 5, y - h / 2 - 12, w + 10, h + 18, 6).stroke({ width: 2.5, color: 0xe8b26a, alpha: 0.9 })
  }
  c.addChild(g)

  if (!biome && kind !== 'parking' && kind !== 'first-aid' && kind !== 'patrol-hq') {
    const monogram = new Text({
      text: spec.label.charAt(0).toUpperCase(),
      style: { fontFamily: 'Fraunces, serif', fontSize: big ? 13 : 10, fontWeight: '600', fill: 0xfaf6ef },
    })
    monogram.anchor.set(0.5)
    monogram.position.set(x, y + 1)
    c.addChild(monogram)
  }
  return c
}

/** compact key of everything that requires a static redraw when changed */
function structureKeyOf(game: GameState, selection: Selection, buildMode: BuildMode, overlay: Overlay): string {
  const lifts = Object.values(game.lifts)
    .map((l) => `${l.siteId}:${l.kind}:${l.open ? 1 : 0}:${l.forcedClosed ?? ''}`)
    .join(',')
  const trails = Object.values(game.trails)
    .map((t) => {
      const cap = (TRAIL_MAP[t.trailId] ?? game.customTrailDefs[t.trailId])?.capacity ?? 50
      return `${t.trailId}:${t.built ? 1 : 0}:${t.open ? 1 : 0}:${t.surface}:${Math.min(18, Math.floor(t.traffic / 5))}:${t.hasSnowmaking ? 1 : 0}${overlay === 'snow' ? ':' + Math.round(t.snowDepthCm) : ''}${overlay === 'crowding' ? ':' + Math.min(9, Math.floor((t.skierIds.length / cap) * 4)) : ''}`
    })
    .join(',')
  const fac = Object.entries(game.facilities)
    .map(([k, v]) => `${k}:${v ?? ''}`)
    .join(',')
  const sel = selection ? `${selection.type}:${selection.id}` : ''
  const bm = buildMode ? `${buildMode.type}:${'kind' in buildMode ? buildMode.kind : ''}` : ''
  // staffing affects which lifts run (status dots)
  const ops = game.staff.find((d) => d.role === 'lift-ops')?.headcount ?? 0
  const junctions = Object.keys(game.junctions).join(',')
  return [lifts, trails, fac, sel, bm, overlay, ops, junctions, game.phase].join('|')
}
