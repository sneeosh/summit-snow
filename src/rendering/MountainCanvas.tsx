/** React wrapper that owns the Pixi Application and MountainScene lifecycle. */
import { useEffect, useRef } from 'react'
import { Application } from 'pixi.js'
import { MountainScene } from './scene'
import { useStore } from '../state/store'

export function MountainCanvas() {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<MountainScene | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let scene: MountainScene | null = null
    let observer: ResizeObserver | null = null

    const app = new Application()
    app
      .init({
        width: Math.max(1, host.clientWidth),
        height: Math.max(1, host.clientHeight),
        background: '#dfe9ef',
        antialias: true,
        // resolution stays 1: some Chrome builds apply the GL viewport at
        // logical size while the buffer is DPR-scaled, painting the scene
        // into one quadrant. A 1:1 buffer can't mismatch anywhere.
        resolution: 1,
        autoDensity: false,
      })
      .then(() => {
        if (cancelled) {
          app.destroy(true)
          return
        }
        // The canvas must always fill the host visually, no matter what any
        // autoDensity/style computation decides — CSS is the authority.
        app.canvas.style.display = 'block'
        app.canvas.style.width = '100%'
        app.canvas.style.height = '100%'
        host.appendChild(app.canvas)
        scene = new MountainScene(
          app,
          () => {
            const s = useStore.getState()
            return { game: s.game, selection: s.selection, buildMode: s.buildMode, overlay: s.overlay }
          },
          {
            onSelect: (sel) => useStore.getState().select(sel),
            onSlotClick: (slotId) => {
              const s = useStore.getState()
              if (s.buildMode?.type === 'facility') s.buildFacility(slotId, s.buildMode.kind)
            },
            onLiftSiteClick: (siteId) => {
              const s = useStore.getState()
              if (s.buildMode?.type === 'lift') s.buildLift(siteId, s.buildMode.kind)
            },
            onTrailClick: (trailId) => {
              const s = useStore.getState()
              if (s.buildMode?.type === 'trail') s.buildTrail(trailId)
              if (s.buildMode?.type === 'snowmaking') s.installSnowmaking(trailId)
            },
            onDrawPoint: (p) => useStore.getState().addDrawPoint(p),
          },
        )
        sceneRef.current = scene

        // Source of truth for canvas size: the host element's laid-out box.
        // ResizeObserver fires once on observe, correcting any init-time
        // measurement, and again on every window/layout change.
        const syncSize = () => {
          const w = host.clientWidth
          const h = host.clientHeight
          if (w < 1 || h < 1) return
          const screen = app.renderer.screen
          if (screen.width !== w || screen.height !== h) {
            app.renderer.resize(w, h)
            // resize() may rewrite the canvas style in px; reassert CSS fill
            app.canvas.style.width = '100%'
            app.canvas.style.height = '100%'
            scene?.fitCamera()
          }
        }
        observer = new ResizeObserver(syncSize)
        observer.observe(host)
        syncSize()
        console.info(
          `[summit-snow] canvas r4: host ${host.clientWidth}x${host.clientHeight}, ` +
            `screen ${app.renderer.screen.width}x${app.renderer.screen.height}, dpr ${window.devicePixelRatio}`,
        )
        if (import.meta.env.DEV) reportDiagnostics(host, app, 'boot')
        if (import.meta.env.DEV) setTimeout(() => reportDiagnostics(host, app, 't+2s'), 2000)
      })

    return () => {
      cancelled = true
      observer?.disconnect()
      sceneRef.current?.destroy()
      sceneRef.current = null
    }
  }, [])

  return <div ref={hostRef} className="absolute inset-0 overflow-hidden" />
}

/** dev-only: ship layout measurements to the dev server for remote debugging */
function reportDiagnostics(host: HTMLElement, app: Application, phase: string): void {
  try {
    const rect = (el: Element | null) =>
      el
        ? (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(
            el.getBoundingClientRect(),
          )
        : null
    const canvas = app.canvas as HTMLCanvasElement
    const payload = {
      phase,
      ua: navigator.userAgent,
      dpr: window.devicePixelRatio,
      inner: { w: window.innerWidth, h: window.innerHeight },
      visualViewport: window.visualViewport
        ? { w: Math.round(window.visualViewport.width), h: Math.round(window.visualViewport.height), scale: window.visualViewport.scale }
        : null,
      html: rect(document.documentElement),
      body: rect(document.body),
      root: rect(document.getElementById('root')),
      hostParent: rect(host.parentElement),
      host: rect(host),
      canvas: rect(canvas),
      canvasStyle: { w: canvas.style.width, h: canvas.style.height },
      canvasBuffer: { w: canvas.width, h: canvas.height },
      screen: { w: app.renderer.screen.width, h: app.renderer.screen.height },
      resolution: app.renderer.resolution,
    }
    void fetch('/__diag', { method: 'POST', body: JSON.stringify(payload) })
  } catch {
    // diagnostics must never break the game
  }
}
