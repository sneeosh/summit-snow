import { beforeEach, describe, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({ effect: null as null | (() => (() => void)), host: { clientWidth: 800, clientHeight: 600, appendChild: vi.fn() }, app: null as any, scene: null as any, failure: vi.fn(), speed: vi.fn(), init: () => Promise.resolve(), callbacks: null as any }))
vi.mock('react', () => ({ useRef: () => ({ current: h.host }), useEffect: (fn: any) => { h.effect = fn }, useState: (initial: any) => [initial, h.failure] }))
vi.mock('../state/store', () => ({ useStore: { getState: () => ({ setSpeed: h.speed }) } }))
vi.mock('./diagnostics', () => ({ recordRenderFailure: vi.fn() }))
vi.mock('pixi.js', () => ({ Application: class {
  canvas = Object.assign(new EventTarget(), { style: {} })
  ticker = { remove: vi.fn(), add: vi.fn() }
  renderer = { screen: { width: 800, height: 600 } }
  init = vi.fn(() => h.init())
  stop = vi.fn(); start = vi.fn(); render = vi.fn(); destroy = vi.fn()
  constructor() { h.app = this }
} }))
vi.mock('./scene', () => ({ MountainScene: class {
  destroy = vi.fn(); fitCamera = vi.fn()
  constructor(_app: any, _get: any, callbacks: any) { h.scene = this; h.callbacks = callbacks }
} }))
import { MountainCanvas } from './MountainCanvas'
async function mount() {
  MountainCanvas()
  const cleanup = h.effect!()
  await Promise.resolve(); await Promise.resolve()
  return cleanup
}
beforeEach(() => {
  vi.clearAllMocks(); h.scene = null; h.init = () => Promise.resolve()
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('window', { devicePixelRatio: 1 })
})
describe('mountain display lifecycle', () => {
  it('destroys an application that finishes initialization after leaving Mountain', async () => {
    let finish!: () => void
    h.init = () => new Promise<void>(resolve => { finish = resolve })
    const cleanup = await mount()
    cleanup(); finish(); await Promise.resolve()
    expect(h.app.destroy).toHaveBeenCalledWith(true)
    expect(h.scene).toBeNull()
  })
  it('pauses and exposes recovery when initialization rejects, even without an initialized ticker', async () => {
    h.init = () => Promise.reject(new Error('GPU unavailable'))
    MountainCanvas(); const cleanup = h.effect!(); h.app.stop = undefined
    await Promise.resolve(); await Promise.resolve()
    expect(h.failure).toHaveBeenCalledWith(expect.stringContaining('current game'))
    expect(h.speed).toHaveBeenCalledWith(0)
    cleanup()
  })
  it('catches lost contexts and detaches its listener when switching to Town', async () => {
    const cleanup = await mount()
    const event = new Event('webglcontextlost', { cancelable: true })
    h.app.canvas.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(h.speed).toHaveBeenCalledWith(0)
    cleanup()
    expect(h.scene.destroy).toHaveBeenCalledOnce()
    h.app.canvas.dispatchEvent(new Event('webglcontextlost'))
    expect(h.failure).toHaveBeenCalledOnce()
  })
  it('surfaces GPU submission errors and does not render again after failure', async () => {
    const cleanup = await mount()
    h.app.render.mockImplementation(() => { throw new Error('GPU submission') })
    const draw = h.app.ticker.add.mock.calls[0][0]
    draw(); draw()
    expect(h.app.render).toHaveBeenCalledOnce()
    expect(h.failure).toHaveBeenCalledOnce()
    cleanup()
  })
  it('accepts scene-frame failures and gives the next mount a fresh renderer', async () => {
    const cleanup = await mount(); const previous = h.app
    h.callbacks.onError(new Error('scene failure'))
    expect(previous.stop).toHaveBeenCalledOnce()
    cleanup()
    const cleanup2 = await mount()
    expect(h.app).not.toBe(previous)
    expect(h.app.start).toHaveBeenCalledOnce()
    cleanup2()
  })
})
