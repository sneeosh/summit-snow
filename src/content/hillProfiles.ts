import { mountainElevation } from '../game/elevation'
import type { Difficulty, MountainDef, MountainIdentity, MountainNode, TrailDef, Vec2 } from '../game/types'

const IDENTITIES: Record<string, MountainIdentity> = {
  prairie: {
    biome: 'hardwood', accent: '#a84437',
    strategy: 'Short laps, happy learners. Prioritize lessons, grooming and snowmaking before chasing vertical.',
    development: 'Schoolhouse Meadow offers broad teaching terrain. Oak Ridge adds longer laps for returning skiers.',
    camera: { center: { x: 980, y: 850 }, width: 1220, height: 700 },
    landforms: [
      { name: 'Oak Ridge', kind: 'ridge', center: { x: 660, y: 750 }, radius: { x: 340, y: 110 }, reliefM: 24, windMultiplier: 1.1 },
      { name: 'Schoolhouse Meadow', kind: 'meadow', center: { x: 1220, y: 885 }, radius: { x: 340, y: 125 }, reliefM: -14, windMultiplier: 0.75 },
    ],
  },
  yuki: {
    biome: 'birch', accent: '#a33e47',
    strategy: 'Keep a groomed route for learners and preserve powder for stronger skiers. Birch glades are the draw.',
    development: 'Silver Birch Bowl holds sheltered snow. Fox Ridge offers a steeper expansion above the village.',
    camera: { center: { x: 1010, y: 735 }, width: 1820, height: 1100 },
    landforms: [
      { name: 'Silver Birch Bowl', kind: 'bowl', center: { x: 690, y: 630 }, radius: { x: 350, y: 255 }, reliefM: -100, windMultiplier: 0.55 },
      { name: 'Fox Ridge', kind: 'ridge', center: { x: 1300, y: 630 }, radius: { x: 220, y: 285 }, reliefM: 105, windMultiplier: 1.3 },
    ],
  },
  kea: {
    biome: 'tussock', accent: '#aa743b',
    strategy: 'Build around the wind. A sheltered bowl lift can keep turning when a ridge alignment must close.',
    development: 'Lee Basin is the dependable expansion. The Remarkable Ridge trades shelter for a dramatic fall line.',
    camera: { center: { x: 990, y: 745 }, width: 1880, height: 1080 },
    landforms: [
      { name: 'Lee Basin', kind: 'bowl', center: { x: 620, y: 650 }, radius: { x: 410, y: 275 }, reliefM: -135, windMultiplier: 0.5 },
      { name: 'Remarkable Ridge', kind: 'ridge', center: { x: 1300, y: 640 }, radius: { x: 235, y: 300 }, reliefM: 140, windMultiplier: 1.55 },
      { name: 'Tussock Terrace', kind: 'meadow', center: { x: 1500, y: 940 }, radius: { x: 200, y: 75 }, reliefM: -12, windMultiplier: 0.8 },
    ],
  },
}

/** A new content revision. Legacy objects are retained intact for old saves. */
export function withHillIdentity(original: MountainDef): MountainDef {
  const identity = IDENTITIES[original.id]
  if (!identity) return original
  const m: MountainDef = { ...original, identity }
  if (m.id === 'kea') m.skyline = [[0, 660], [230, 490], [400, 560], [670, 340], [880, 470], [1120, 400], [1320, 360], [1510, 510], [1760, 480], [1920, 670]]
  if (m.id === 'yuki') m.skyline = [[0, 610], [280, 530], [500, 380], [800, 300], [960, 280], [1160, 315], [1380, 390], [1600, 520], [1920, 590]]
  const prairie = m.id === 'prairie'
  const yuki = m.id === 'yuki'
  const base: Vec2 = prairie ? { x: 1080, y: 1040 } : yuki ? { x: 1180, y: 1040 } : { x: 1390, y: 1040 }
  const top: Vec2 = prairie ? { x: 920, y: 920 } : yuki ? { x: 820, y: 920 } : { x: 1050, y: 930 }
  const node = (id: string, name: string, pos: Vec2, isBase = false): MountainNode =>
    ({ id, name, pos, isBase, elevation: mountainElevation(m, pos) })
  m.nodes = [node('base', prairie ? 'Schoolhouse Base' : yuki ? 'Lantern Village' : 'Access Road Base', base, true),
    node('beginner-top', prairie ? 'Learning Knoll' : yuki ? 'Birch Gate' : 'Shelter Knoll', top)]
  m.walkEdges = []
  m.liftSites = [{ id: 'starter-carpet', name: prairie ? 'Schoolhouse Carpet' : yuki ? 'Birch Carpet' : 'Terrace Tow',
    bottomNodeId: 'base', topNodeId: 'beginner-top', allowedKinds: ['surface', 'chair'], prebuilt: 'surface' }]

  const trail = (id: string, name: string, path: Vec2[], widthM: number, trees: number,
    difficulty: Difficulty = 'green'): TrailDef => {
    let lengthM = 0
    for (let i = 1; i < path.length; i++) {
      lengthM += Math.hypot(Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y) * 2,
        mountainElevation(m, path[i - 1]) - mountainElevation(m, path[i]))
    }
    return { id, name, path, difficulty, topNodeId: 'beginner-top', bottomNodeId: 'base',
      lengthM: Math.round(lengthM), verticalM: Math.round(mountainElevation(m, top) - m.baseElev),
      widthM, treeCoverage: trees, scenicAppeal: prairie ? 0.5 : 0.85, riskFactor: 0.7,
      capacity: prairie ? 90 : 65, buildCost: 0 }
  }
  m.trails = prairie ? [
    trail('bunny', 'Schoolhouse', [top, { x: 980, y: 965 }, base], 54, 0.1),
    trail('meadow-loop', 'Oak Loop', [top, { x: 770, y: 950 }, { x: 840, y: 985 }, { x: 960, y: 1010 }, base], 36, 0.35),
  ] : yuki ? [
    trail('bunny', 'Lantern Lane', [top, { x: 960, y: 950 }, { x: 1080, y: 1000 }, base], 38, 0.4),
    trail('meadow-loop', 'Birch Ribbon', [top, { x: 640, y: 940 }, { x: 760, y: 975 }, { x: 960, y: 1005 }, base], 26, 0.7),
  ] : [
    trail('bunny', 'Terrace Traverse', [top, { x: 1180, y: 965 }, { x: 1280, y: 1000 }, base], 40, 0.02),
    trail('meadow-loop', 'Tussock Loop', [top, { x: 850, y: 950 }, { x: 1010, y: 985 }, { x: 1220, y: 1020 }, base], 32, 0.01),
  ]
  m.prebuiltTrails = ['bunny', 'meadow-loop']
  // A compact teaching campus, a village street, and an isolated roadhead.
  const villageXs = prairie ? [1010, 1180, 920, 1270, 830, 1360, 740, 1450]
    : yuki ? [1100, 1250, 1010, 1340, 920, 1430, 830, 1520]
      : [1390, 1510, 1280, 1610, 1170, 1070, 970, 870]
  m.facilitySlots = original.facilitySlots.map((slot) => {
    if (slot.id.startsWith('v')) {
      const i = Number(slot.id.slice(1)) - 1
      return { ...slot, pos: { x: villageXs[i], y: 1090 + (i % 2) * (yuki ? 40 : 15) } }
    }
    if (slot.id.startsWith('p')) {
      const i = Number(slot.id.slice(1)) - 1
      return { ...slot, pos: { x: (prairie ? 1420 : yuki ? 590 : 1630) + (i % 2) * 85, y: 1130 + Math.floor(i / 2) * 45 } }
    }
    return { ...slot, pos: prairie ? { x: 1120, y: 835 } : yuki ? { x: 850, y: 720 } : { x: 630, y: 740 } }
  })
  const parking = m.facilitySlots.find((s) => s.id === 'p1')!
  m.entrance = { x: parking.pos.x, y: parking.pos.y - 15 }
  return m
}
