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

    const app = new Application()
    app
      .init({
        resizeTo: host,
        background: '#dfe9ef',
        antialias: true,
        resolution: Math.min(2, window.devicePixelRatio || 1),
        autoDensity: true,
      })
      .then(() => {
        if (cancelled) {
          app.destroy(true)
          return
        }
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
          },
        )
        sceneRef.current = scene
        const onResize = () => scene?.fitCamera()
        window.addEventListener('resize', onResize)
        ;(scene as MountainScene & { _onResize?: () => void })._onResize = onResize
      })

    return () => {
      cancelled = true
      const s = sceneRef.current as (MountainScene & { _onResize?: () => void }) | null
      if (s?._onResize) window.removeEventListener('resize', s._onResize)
      sceneRef.current?.destroy()
      sceneRef.current = null
    }
  }, [])

  return <div ref={hostRef} className="absolute inset-0 overflow-hidden" />
}
