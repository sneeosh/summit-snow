import { mountainElevation } from '../game/elevation'
import type { MountainDef, MountainIdentity, Vec2 } from '../game/types'

const PROFILES: Record<string, MountainIdentity> = {
  granite: {
    biome: 'granite', accent: '#864546',
    strategy: 'A narrow wooded mountain. Keep the learning slopes groomed and use sheltered terrain when the ridge is windy.',
    development: 'Hemlock Hollow is protected by the ridge. The Ledges offer steeper skiing above the old base lodge.',
    camera: { center: { x: 910, y: 780 }, width: 1680, height: 980 },
    landforms: [
      { name: 'Hemlock Hollow', kind: 'bowl', center: { x: 630, y: 730 }, radius: { x: 280, y: 180 }, reliefM: -60, windMultiplier: 0.6 },
      { name: 'The Ledges', kind: 'ridge', center: { x: 1190, y: 690 }, radius: { x: 170, y: 210 }, reliefM: 80, windMultiplier: 1.35 },
    ],
  },
  alder: {
    biome: 'fir', accent: '#366657',
    strategy: 'Grow the family hill into a forest resort. Connect the surveyed blues and keep a welcoming route down for learners.',
    development: 'The lower forest shelters the existing learning area. The summit is a larger, more exposed investment.',
    camera: { center: { x: 960, y: 720 }, width: 1740, height: 1140 },
    // Keep the authored scenario grades, stations and tutorial corridors intact.
    landforms: [],
  },
  elk: {
    biome: 'aspen', accent: '#af8436',
    strategy: 'Spread the weekend crowds across both peaks. Intermediate circuits and enough lift capacity are the business.',
    development: 'Aspen Basin is the natural first expansion. Elk Shoulder opens the second side of the mountain.',
    camera: { center: { x: 970, y: 725 }, width: 1840, height: 1130 },
    landforms: [
      { name: 'Aspen Basin', kind: 'bowl', center: { x: 660, y: 640 }, radius: { x: 300, y: 230 }, reliefM: -90, windMultiplier: 0.7 },
      { name: 'Elk Shoulder', kind: 'ridge', center: { x: 1330, y: 610 }, radius: { x: 300, y: 260 }, reliefM: 110, windMultiplier: 1.2 },
    ],
  },
  wasatch: {
    biome: 'limestone', accent: '#667da1',
    strategy: 'Experts come for powder and sustained pitches. Pair ungroomed terrain with enough patrol and a dependable groomed way home.',
    development: 'Cathedral Bowl holds the powder. The exposed Crown Spine has a steeper, less forgiving fall line.',
    camera: { center: { x: 1040, y: 720 }, width: 1840, height: 1140 },
    landforms: [
      { name: 'Cathedral Bowl', kind: 'bowl', center: { x: 770, y: 610 }, radius: { x: 360, y: 265 }, reliefM: -150, windMultiplier: 0.55 },
      { name: 'Crown Spine', kind: 'ridge', center: { x: 1320, y: 590 }, radius: { x: 190, y: 270 }, reliefM: 145, windMultiplier: 1.45 },
    ],
  },
  blanche: {
    biome: 'glacier', accent: '#427f9a',
    strategy: 'Build a connected journey from the valley to high terrain. Long lifts need return routes and services up the mountain.',
    development: 'Glacier Shelf is a high alpine destination. Aiguille Ridge demands careful trail routing; the village nursery remains gentle.',
    camera: { center: { x: 960, y: 690 }, width: 1860, height: 1200 },
    landforms: [
      { name: 'Glacier Shelf', kind: 'bowl', center: { x: 680, y: 480 }, radius: { x: 320, y: 240 }, reliefM: -145, windMultiplier: 0.8 },
      { name: 'Aiguille Ridge', kind: 'ridge', center: { x: 1320, y: 530 }, radius: { x: 160, y: 300 }, reliefM: 185, windMultiplier: 1.5 },
    ],
  },
}

export function withAlpineIdentity(previous: MountainDef): MountainDef {
  const identity = PROFILES[previous.id]
  if (!identity) return previous
  const m = { ...previous, identity }
  if (m.id === 'alder') return m
  const spec = {
    granite: { base: { x: 790, y: 1040 }, top: { x: 390, y: 970 }, name: 'Old Mill', topName: 'Hemlock Gate', run: 'Maple Lane', loop: 'Mill Brook', village: 780, parking: 1320 },
    elk: { base: { x: 1050, y: 1040 }, top: { x: 580, y: 940 }, name: 'Aspen Village', topName: 'Aspen Gate', run: 'Golden Turns', loop: 'Aspen Promenade', village: 1030, parking: 1510 },
    wasatch: { base: { x: 1390, y: 1040 }, top: { x: 940, y: 950 }, name: 'Canyon Base', topName: 'Canyon Knoll', run: 'Canyon Way', loop: 'Little Cottonwood', village: 1300, parking: 1670 },
    blanche: { base: { x: 1060, y: 1040 }, top: { x: 510, y: 970 }, name: 'Valley Village', topName: 'Village Terrace', run: 'Promenade', loop: 'Le Jardin', village: 1000, parking: 1530 },
  }[m.id]!
  m.nodes = [
    { id: 'base', name: spec.name, pos: spec.base, elevation: m.baseElev, isBase: true },
    { id: 'beginner-top', name: spec.topName, pos: spec.top, elevation: mountainElevation(m, spec.top), isBase: false },
  ]
  m.walkEdges = []
  m.liftSites = [{ id: 'starter-carpet', name: `${spec.topName} Carpet`, bottomNodeId: 'base', topNodeId: 'beginner-top', allowedKinds: ['surface', 'chair'], prebuilt: 'surface' }]
  const mid = (f: number, shift = 0): Vec2 => ({ x: spec.top.x + (spec.base.x - spec.top.x) * f + shift, y: spec.top.y + (spec.base.y - spec.top.y) * f })
  const routes = [[spec.top, mid(0.35), mid(0.75), spec.base],
    [spec.top, mid(0.13, -130), mid(0.4, -140), mid(0.73, -70), spec.base]]
  m.trails = routes.map((path, i) => ({
    id: i ? 'meadow-loop' : 'bunny', name: i ? spec.loop : spec.run, difficulty: 'green',
    topNodeId: 'beginner-top', bottomNodeId: 'base', path,
    lengthM: Math.round(path.slice(1).reduce((total, p, j) => total + Math.hypot(
      Math.hypot(p.x - path[j].x, p.y - path[j].y) * 2, mountainElevation(m, path[j]) - mountainElevation(m, p)), 0)),
    verticalM: Math.round(mountainElevation(m, spec.top) - m.baseElev), widthM: i ? 28 : 42,
    treeCoverage: i ? 0.55 : 0.2, scenicAppeal: m.id === 'blanche' ? 0.95 : 0.65,
    riskFactor: 0.7, capacity: i ? 65 : 85, buildCost: 0,
  }))
  m.prebuiltTrails = ['bunny', 'meadow-loop']
  m.facilitySlots = previous.facilitySlots.map((slot) => {
    if (slot.id.startsWith('v')) {
      const n = Number(slot.id.slice(1)) - 1
      return { ...slot, pos: { x: spec.village + (n % 4 - 1) * 110, y: 1085 + Math.floor(n / 4) * 55 } }
    }
    if (slot.id.startsWith('p')) {
      const n = Number(slot.id.slice(1)) - 1
      return { ...slot, pos: { x: spec.parking + (n % 2) * 80, y: 1100 + Math.floor(n / 2) * 65 } }
    }
    return { ...slot, pos: { x: m.id === 'blanche' ? 790 : 840, y: m.id === 'granite' ? 755 : 630 } }
  })
  m.entrance = { x: spec.parking, y: 1080 }
  return m
}
