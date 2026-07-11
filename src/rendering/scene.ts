/**
 * MountainScene — owns the Pixi stage: camera, terrain backdrop, trails,
 * lifts (with animated chairs), buildings, guest dots, weather particles,
 * overlays, selection highlights, and build-mode previews.
 *
 * Static structure (trails/lifts/buildings) rebuilds only when a structure
 * key changes; guests and chairs update every animation frame.
 */
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import {
  FACILITY_SLOTS,
  LIFT_LINES,
  LIFT_SITES,
  pointAt,
  TRAIL_MAP,
  TRAIL_PATHS,
  TRAILS,
  WORLD_H,
  WORLD_W,
} from '../content/mountain'
import { FACILITIES } from '../content/balance'
import { hashNoise } from '../game/rng'
import { isLiftRunning } from '../game/resort'
import type { GameState, TrailState, Vec2 } from '../game/types'
import type { BuildMode, Overlay, Selection } from '../state/store'
import { moodFromWeather, paintTerrain } from './terrain'

const DIFF_COLOR: Record<string, number> = {
  green: 0x2e7d4f,
  blue: 0x2f6fb2,
  black: 0x22262a,
  'double-black': 0x22262a,
}

const GUEST_TINTS: Record<string, number> = {
  skiing: 0x2c3e4a,
  riding: 0x5a7184,
  queueing: 0xc77f3d,
  walking: 0x8a6d55,
  leaving: 0x9aa7b0,
  default: 0x77694f,
}

export interface SceneCallbacks {
  onSelect: (sel: Selection) => void
  onSlotClick: (slotId: string) => void
  onLiftSiteClick: (siteId: string) => void
  onTrailClick: (trailId: string) => void
}

export class MountainScene {
  app: Application
  world = new Container()
  private terrainSprite: Sprite | null = null
  private trailLayer = new Container()
  private liftLayer = new Container()
  private buildingLayer = new Container()
  private guestLayer = new Container()
  private weatherLayer = new Container()
  private previewLayer = new Container()
  private labelLayer = new Container()

  private guestSprites = new Map<number, Sprite>()
  private chairSprites: { liftId: string; sprites: Sprite[] }[] = []
  private snowSprites: Sprite[] = []
  private dotTexture: Texture
  private flakeTexture: Texture

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
  private onKeyDown = (e: KeyboardEvent) => this.handlePanKey(e, true)
  private onKeyUp = (e: KeyboardEvent) => this.handlePanKey(e, false)
  private onBlur = () => this.panKeys.clear()

  constructor(
    app: Application,
    getState: MountainScene['getState'],
    callbacks: SceneCallbacks,
  ) {
    this.app = app
    this.getState = getState
    this.callbacks = callbacks

    this.world.addChild(this.trailLayer, this.liftLayer, this.buildingLayer, this.guestLayer, this.labelLayer, this.previewLayer, this.weatherLayer)
    app.stage.addChild(this.world)

    this.dotTexture = this.makeCircleTexture(5)
    this.flakeTexture = this.makeCircleTexture(2.4)

    this.fitCamera()
    this.bindInput()

    app.ticker.add(() => this.frame())
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    this.app.destroy(true, { children: true })
  }

  // ------------------------------------------------------------- camera

  fitCamera(): void {
    const w = this.app.renderer.width / this.app.renderer.resolution
    const h = this.app.renderer.height / this.app.renderer.resolution
    const fit = Math.max(w / WORLD_W, h / WORLD_H)
    // zooming all the way out still shows the whole mountain…
    this.minZoom = fit
    // …but open closer in, centred on the base village, so there's terrain
    // to pan across from the first moment
    this.zoom = fit * 1.35
    this.world.scale.set(this.zoom)
    const village = { x: 950, y: 1000 }
    this.world.position.set(w / 2 - village.x * this.zoom, h - WORLD_H * this.zoom)
    this.clampCamera()
  }

  private clampCamera(): void {
    const w = this.app.renderer.width / this.app.renderer.resolution
    const h = this.app.renderer.height / this.app.renderer.resolution
    const ww = WORLD_W * this.zoom
    const wh = WORLD_H * this.zoom
    this.world.x = ww <= w ? (w - ww) / 2 : Math.min(0, Math.max(w - ww, this.world.x))
    this.world.y = wh <= h ? (h - wh) / 2 : Math.min(0, Math.max(h - wh, this.world.y))
  }

  private bindInput(): void {
    const canvas = this.app.canvas as HTMLCanvasElement
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
      const newZoom = Math.max(this.minZoom, Math.min(3.2, this.zoom * factor))
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const worldX = (mx - this.world.x) / this.zoom
      const worldY = (my - this.world.y) / this.zoom
      this.zoom = newZoom
      this.world.scale.set(newZoom)
      this.world.x = mx - worldX * newZoom
      this.world.y = my - worldY * newZoom
      this.clampCamera()
    }, { passive: false })

    canvas.addEventListener('pointerdown', (e) => {
      this.dragging = true
      this.dragMoved = false
      this.dragStart = { x: e.clientX, y: e.clientY }
      this.worldStart = { x: this.world.x, y: this.world.y }
    })
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging) return
      const dx = e.clientX - this.dragStart.x
      const dy = e.clientY - this.dragStart.y
      if (Math.abs(dx) + Math.abs(dy) > 6) this.dragMoved = true
      this.world.x = this.worldStart.x + dx
      this.world.y = this.worldStart.y + dy
      this.clampCamera()
    })
    window.addEventListener('pointerup', (e) => {
      if (!this.dragging) return
      this.dragging = false
      if (!this.dragMoved) this.handleClick(e)
    })

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
  }

  private handlePanKey(e: KeyboardEvent, down: boolean): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const dir = MountainScene.PAN_KEYS[e.key.toLowerCase()]
    if (!dir) return
    if (down) {
      this.panKeys.add(dir)
      e.preventDefault() // keep arrow keys from scrolling the page
    } else {
      this.panKeys.delete(dir)
    }
  }

  /** apply held pan keys; called every frame with the ticker's delta */
  private panCamera(deltaMS: number): void {
    if (this.panKeys.size === 0) return
    const step = 0.9 * deltaMS // screen px — steady speed regardless of zoom
    if (this.panKeys.has('up')) this.world.y += step
    if (this.panKeys.has('down')) this.world.y -= step
    if (this.panKeys.has('left')) this.world.x += step
    if (this.panKeys.has('right')) this.world.x -= step
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

    // build mode: clicks target the relevant ghost sites
    if (buildMode?.type === 'facility') {
      const slot = this.nearestFreeSlot(game, p, buildMode.kind)
      if (slot) {
        this.callbacks.onSlotClick(slot)
        return
      }
    }
    if (buildMode?.type === 'lift') {
      const site = this.nearestLiftSite(p, 40, game, true)
      if (site) {
        this.callbacks.onLiftSiteClick(site)
        return
      }
    }
    if (buildMode?.type === 'trail' || buildMode?.type === 'snowmaking') {
      const trailId = this.nearestTrail(p, 34)
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
    const lift = this.nearestLiftSite(p, 22, game, false)
    if (lift && game.lifts[lift]) {
      this.callbacks.onSelect({ type: 'lift', id: lift })
      return
    }
    const trailId = this.nearestTrail(p, 26)
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

  private nearestLiftSite(p: Vec2, threshold: number, game: GameState, unbuiltOnly: boolean): string | null {
    let best: string | null = null
    let bestD = threshold
    for (const site of LIFT_SITES) {
      if (unbuiltOnly && game.lifts[site.id]) continue
      const d = distToMeasured(p, LIFT_LINES[site.id])
      if (d < bestD) {
        bestD = d
        best = site.id
      }
    }
    return best
  }

  private nearestTrail(p: Vec2, threshold: number): string | null {
    let best: string | null = null
    let bestD = threshold
    for (const t of TRAILS) {
      const d = distToMeasured(p, TRAIL_PATHS[t.id])
      if (d < bestD) {
        bestD = d
        best = t.id
      }
    }
    return best
  }

  // ---------------------------------------------------------- frame loop

  private frame(): void {
    this.panCamera(this.app.ticker.deltaMS)

    const { game, selection, buildMode, overlay } = this.getState()
    if (!game) return

    // terrain mood repaint (rare)
    const weather = game.weatherSeason[game.day - 1]
    const tKey = `${game.day}|${weather.cloud.toFixed(2)}|${weather.visibility.toFixed(2)}`
    if (tKey !== this.terrainKey) {
      this.terrainKey = tKey
      const canvas = paintTerrain(moodFromWeather(weather), game.seed)
      const texture = Texture.from(canvas)
      if (this.terrainSprite) {
        const old = this.terrainSprite.texture
        this.terrainSprite.texture = texture
        old.destroy(true)
      } else {
        this.terrainSprite = new Sprite(texture)
        this.world.addChildAt(this.terrainSprite, 0)
      }
    }

    // structural rebuild (rare)
    const sKey = structureKeyOf(game, selection, buildMode, overlay)
    if (sKey !== this.structureKey) {
      this.structureKey = sKey
      this.rebuildStatic(game, selection, buildMode, overlay)
    }

    this.updateGuests(game)
    this.updateChairs(game)
    this.updateWeather(game)
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
  }

  private drawTrails(game: GameState, selection: Selection, buildMode: BuildMode, overlay: Overlay): void {
    for (const def of TRAILS) {
      const st = game.trails[def.id]
      const mp = TRAIL_PATHS[def.id]
      const g = new Graphics()
      const width = Math.max(10, def.widthM * 0.55)

      if (st.built) {
        const ribbonColor = overlayTrailColor(overlay, st, def.difficulty)
        // carved-edge shadow so the piste reads against open snowfield
        strokePath(g, mp.points, width + 5, 0x9db4c4, st.open ? 0.5 : 0.3)
        // ribbon
        strokePath(g, mp.points, width, st.open ? ribbonColor.color : 0xdde3e8, st.open ? ribbonColor.alpha : 0.75)
        // difficulty edges, both sides
        strokePath(g, mp.points, 2.2, DIFF_COLOR[def.difficulty], st.open ? 0.9 : 0.35, width / 2 + 2)
        strokePath(g, mp.points, 2.2, DIFF_COLOR[def.difficulty], st.open ? 0.9 : 0.35, -(width / 2 + 2))
        if (!st.open) {
          // closed: crosshatch ropes
          const mid = pointAt(mp, 0.08)
          g.circle(mid.x, mid.y, 8).fill({ color: 0xd95d2e, alpha: 0.95 })
          g.moveTo(mid.x - 4, mid.y - 4).lineTo(mid.x + 4, mid.y + 4).stroke({ width: 2.4, color: 0xffffff })
          g.moveTo(mid.x + 4, mid.y - 4).lineTo(mid.x - 4, mid.y + 4).stroke({ width: 2.4, color: 0xffffff })
        }
        // groomed corduroy hint
        if (st.surface === 'groomed' && st.open) {
          for (let i = 1; i <= 5; i++) {
            const q = pointAt(mp, i / 6)
            g.moveTo(q.x - width * 0.28, q.y - 1.5).lineTo(q.x + width * 0.28, q.y + 1.5).stroke({ width: 1, color: 0xbfd2de, alpha: 0.8 })
          }
        }
      } else {
        // unbuilt corridor ghost
        const isTarget = buildMode?.type === 'trail'
        dashPath(g, mp, 8, 7, isTarget ? 3 : 1.6, isTarget ? 0x2f6fb2 : 0x9db4c2, isTarget ? 0.95 : 0.55)
      }

      // selection halo
      if (selection?.type === 'trail' && selection.id === def.id) {
        strokePath(g, mp.points, width + 8, 0xe8b26a, 0.35)
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
  }

  private drawLifts(game: GameState, selection: Selection, buildMode: BuildMode): void {
    for (const site of LIFT_SITES) {
      const lift = game.lifts[site.id]
      const mp = LIFT_LINES[site.id]
      const a = mp.points[0]
      const b = mp.points[mp.points.length - 1]
      const g = new Graphics()

      if (!lift) {
        // ghost alignment in lift build mode
        if (buildMode?.type === 'lift') {
          dashPath(g, mp, 10, 8, 2.5, 0xa97949, 0.9)
          g.circle(a.x, a.y, 7).stroke({ width: 2.5, color: 0xa97949, alpha: 0.95 })
          g.circle(b.x, b.y, 7).stroke({ width: 2.5, color: 0xa97949, alpha: 0.95 })
          const label = new Text({
            text: `${site.name}`,
            style: { fontFamily: 'Instrument Sans, sans-serif', fontSize: 11, fontWeight: '700', fill: 0xa97949, stroke: { color: 0xffffff, width: 3 } },
          })
          label.position.set((a.x + b.x) / 2 + 8, (a.y + b.y) / 2)
          this.liftLayer.addChild(label)
        }
        this.liftLayer.addChild(g)
        continue
      }

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
    for (const guest of Object.values(game.guests)) {
      seen.add(guest.id)
      let sprite = this.guestSprites.get(guest.id)
      if (!sprite) {
        sprite = new Sprite(this.dotTexture)
        sprite.anchor.set(0.5)
        sprite.scale.set(1)
        sprite.position.set(guest.pos.x, guest.pos.y)
        this.guestLayer.addChild(sprite)
        this.guestSprites.set(guest.id, sprite)
      }
      // smooth toward sim position
      sprite.x += (guest.pos.x - sprite.x) * 0.22
      sprite.y += (guest.pos.y - sprite.y) * 0.22
      sprite.tint = GUEST_TINTS[guest.objective] ?? GUEST_TINTS.default
      // hide guests inside buildings / on gondolas
      const hidden =
        guest.objective === 'eating' ||
        guest.objective === 'resting' ||
        guest.objective === 'restroom' ||
        guest.objective === 'first-aid' ||
        guest.objective === 'buying-ticket' ||
        guest.objective === 'renting'
      sprite.alpha = hidden ? 0 : 0.95
    }
    for (const [id, sprite] of this.guestSprites) {
      if (!seen.has(id)) {
        sprite.destroy()
        this.guestSprites.delete(id)
      }
    }
  }

  private updateChairs(game: GameState): void {
    const t = performance.now() / 1000
    for (const { liftId, sprites } of this.chairSprites) {
      const lift = game.lifts[liftId]
      if (!lift) continue
      const mp = LIFT_LINES[liftId]
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

function overlayTrailColor(overlay: Overlay, st: TrailState, difficulty: string): { color: number; alpha: number } {
  switch (overlay) {
    case 'difficulty':
      return { color: DIFF_COLOR[difficulty], alpha: 0.55 }
    case 'snow': {
      const depth = Math.min(1, st.snowDepthCm / 100)
      // thin = warm alarm, deep = rich blue
      const color = depth < 0.3 ? 0xd95d2e : depth < 0.55 ? 0x7fa8c9 : 0x2f6fb2
      return { color, alpha: 0.6 }
    }
    case 'crowding': {
      const def = TRAIL_MAP[st.trailId]
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
    g.roundRect(x - w / 2, y - h / 2 + 3, w, h - 3, 2).fill({ color: kind === 'first-aid' || kind === 'patrol-hq' ? 0xf4f6f8 : 0x9c7a52 })
    // roof (snowy gable)
    g.poly([x - w / 2 - 4, y - h / 2 + 6, x, y - h / 2 - 8, x + w / 2 + 4, y - h / 2 + 6]).fill({ color: 0xf2f6f9 })
    g.poly([x - w / 2 - 4, y - h / 2 + 6, x, y - h / 2 - 8, x + w / 2 + 4, y - h / 2 + 6]).stroke({ width: 1.4, color: 0x8fa0aa })
    // door
    g.roundRect(x - 3, y + h / 2 - 8, 6, 8, 1).fill({ color: 0x5b4632 })
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

  if (kind !== 'parking' && kind !== 'first-aid' && kind !== 'patrol-hq') {
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
    .map((t) => `${t.trailId}:${t.built ? 1 : 0}:${t.open ? 1 : 0}:${t.surface}:${t.hasSnowmaking ? 1 : 0}${overlay === 'snow' ? ':' + Math.round(t.snowDepthCm) : ''}${overlay === 'crowding' ? ':' + Math.min(9, Math.floor((t.skierIds.length / TRAIL_MAP[t.trailId].capacity) * 4)) : ''}`)
    .join(',')
  const fac = Object.entries(game.facilities)
    .map(([k, v]) => `${k}:${v ?? ''}`)
    .join(',')
  const sel = selection ? `${selection.type}:${selection.id}` : ''
  const bm = buildMode ? `${buildMode.type}:${'kind' in buildMode ? buildMode.kind : ''}` : ''
  // staffing affects which lifts run (status dots)
  const ops = game.staff.find((d) => d.role === 'lift-ops')?.headcount ?? 0
  return [lifts, trails, fac, sel, bm, overlay, ops, game.phase].join('|')
}
