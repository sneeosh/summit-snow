import { afterEach, expect, it, vi } from 'vitest'
import { Cache, Container, Sprite, Texture } from 'pixi.js'
import { MountainScene } from './scene'

// No GPU or fake memory allocation: exercise real Pixi cache/scene ownership.
// Canvas dimensions match paintTerrain's 1920x1200 world plus 260px margins.
class TestCanvas { width = 2440; height = 1720 }
afterEach(() => vi.unstubAllGlobals())

it('production child-only cleanup retains terrain resources in the global Pixi cache', () => {
  vi.stubGlobal('HTMLCanvasElement', TestCanvas)
  const canvas = new TestCanvas()
  const texture = Texture.from(canvas as unknown as HTMLCanvasElement)
  const stage = new Container()
  stage.addChild(new Sprite(texture))
  stage.destroy({ children: true })
  expect(Cache.has(canvas)).toBe(true)
  expect(texture.source.resource).toBe(canvas)
  texture.destroy(true)
  expect(Cache.has(canvas)).toBe(false)
})

it('MountainScene cleanup releases owned textures across 20 remounts and preserves shared guest textures', () => {
  vi.stubGlobal('HTMLCanvasElement', TestCanvas)
  vi.stubGlobal('window', { removeEventListener: vi.fn() })
  const sharedCanvas = new TestCanvas()
  const sharedTexture = Texture.from(sharedCanvas as unknown as HTMLCanvasElement)
  const allOwned: TestCanvas[] = []
  for (let cycle = 0; cycle < 20; cycle++) {
    const canvases = Array.from({ length: 3 }, () => new TestCanvas())
    allOwned.push(...canvases)
    const [terrain, dot, flake] = canvases.map(c => Texture.from(c as unknown as HTMLCanvasElement))
    const stage = new Container()
    const terrainSprite = new Sprite(terrain)
    stage.addChild(terrainSprite, new Sprite(dot), new Sprite(flake), new Sprite(sharedTexture))
    const destroy = vi.fn(() => stage.destroy({ children: true }))
    const scene = Object.assign(Object.create(MountainScene.prototype), {
      app: { destroy }, terrainSprite, dotTexture: dot, flakeTexture: flake,
    }) as MountainScene
    scene.destroy()
    scene.destroy() // strict cleanup stays idempotent
    expect(destroy).toHaveBeenCalledOnce()
    expect(allOwned.filter(c => Cache.has(c))).toHaveLength(0)
    expect(Cache.has(sharedCanvas)).toBe(true)
    expect(sharedTexture.destroyed).toBe(false)
  }
  sharedTexture.destroy(true)
})
