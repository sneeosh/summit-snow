/**
 * The world's mountains — every purchasable resort, each inspired by a real
 * ski area. All share the 1920×1200 trail-map world; what differs is the
 * skyline, the vertical (which changes how steep a drawn line grades), the
 * climate, the forest, the local market, and the price of admission.
 *
 * Authoring conventions every mountain must follow:
 *  - a node with id 'base' at the village (~y 1040), isBase: true
 *  - the base village floor lives at y ≈ 1040–1150 (slots, entrance)
 *  - ySummit equals the lowest y in `skyline`
 *  - at least one prebuilt lift + green trail so day 1 has something open
 */
import type { FacilitySlotDef, MountainDef, MountainNode, TrailDef, Vec2 } from '../game/types'
import { withHillIdentity } from './hillProfiles'

/** the shared base-village build sites; the mid-mountain hut site must sit
 * below the mountain's ridgeline, so its height is per-mountain */
function villageSlots(midMountainY = 545): FacilitySlotDef[] {
  return [
    { id: 'v1', pos: { x: 1010, y: 1092 }, allowed: 'any-village', prebuilt: 'base-lodge' },
    { id: 'v2', pos: { x: 905, y: 1085 }, allowed: 'any-village', prebuilt: 'ticket-office' },
    { id: 'v3', pos: { x: 812, y: 1098 }, allowed: 'any-village' },
    { id: 'v4', pos: { x: 1115, y: 1085 }, allowed: 'any-village' },
    { id: 'v5', pos: { x: 1212, y: 1098 }, allowed: 'any-village' },
    { id: 'v6', pos: { x: 715, y: 1110 }, allowed: 'any-village' },
    { id: 'v7', pos: { x: 1305, y: 1115 }, allowed: 'any-village' },
    { id: 'v8', pos: { x: 618, y: 1096 }, allowed: 'any-village' },
    { id: 'p1', pos: { x: 1430, y: 1140 }, allowed: ['parking'], prebuilt: 'parking' },
    { id: 'p2', pos: { x: 1530, y: 1152 }, allowed: ['parking'] },
    { id: 'p3', pos: { x: 1633, y: 1148 }, allowed: ['parking'] },
    { id: 'p4', pos: { x: 1332, y: 1152 }, allowed: ['parking'] },
    { id: 'm1', pos: { x: 862, y: midMountainY }, allowed: ['cafe', 'restroom', 'first-aid'] },
  ]
}

const ENTRANCE: Vec2 = { x: 1430, y: 1125 }

/**
 * Starter kit for undeveloped mountains: a base node, a knoll above it, a
 * creaky carpet, and two gentle greens — the rest is up to the new owner.
 */
function starterZone(m: {
  baseElev: number
  knollElev: number
  treeCoverage: number
  bunnyVert: number
}): Pick<MountainDef, 'nodes' | 'walkEdges' | 'liftSites' | 'trails' | 'prebuiltTrails'> {
  const nodes: MountainNode[] = [
    { id: 'base', name: 'Base Village', pos: { x: 950, y: 1040 }, elevation: m.baseElev, isBase: true },
    { id: 'beginner-top', name: 'First Knoll', pos: { x: 780, y: 880 }, elevation: m.knollElev, isBase: false },
  ]
  const trails: TrailDef[] = [
    {
      id: 'bunny',
      name: 'First Turns',
      difficulty: 'green',
      topNodeId: 'beginner-top',
      bottomNodeId: 'base',
      path: [
        { x: 780, y: 880 },
        { x: 700, y: 940 },
        { x: 810, y: 990 },
        { x: 950, y: 1040 },
      ],
      lengthM: 780,
      verticalM: m.bunnyVert,
      widthM: 42,
      treeCoverage: m.treeCoverage,
      scenicAppeal: 0.45,
      riskFactor: 0.7,
      buildCost: 0,
      capacity: 60,
    },
    {
      id: 'meadow-loop',
      name: 'Meadow Loop',
      difficulty: 'green',
      topNodeId: 'beginner-top',
      bottomNodeId: 'base',
      path: [
        { x: 780, y: 880 },
        { x: 660, y: 930 },
        { x: 560, y: 1000 },
        { x: 690, y: 1035 },
        { x: 950, y: 1040 },
      ],
      lengthM: 1300,
      verticalM: m.bunnyVert,
      widthM: 32,
      treeCoverage: Math.min(0.7, m.treeCoverage + 0.15),
      scenicAppeal: 0.6,
      riskFactor: 0.8,
      buildCost: 0,
      capacity: 70,
    },
  ]
  return {
    nodes,
    walkEdges: [],
    liftSites: [
      {
        id: 'starter-carpet',
        name: 'Village Carpet',
        bottomNodeId: 'base',
        topNodeId: 'beginner-top',
        allowedKinds: ['surface'],
        prebuilt: 'surface',
      },
    ],
    trails,
    prebuiltTrails: ['bunny', 'meadow-loop'],
  }
}

// --------------------------------------------------------------- Mount Alder
// The original — a mid-size Cascades hill (think Stevens Pass): honest
// vertical, deep maritime snow, forest everywhere, surveyed corridors ready.

const ALDER: MountainDef = {
  id: 'alder',
  name: 'Mount Alder',
  region: 'Cascade Range, USA',
  blurb: 'The family hill: honest vertical, reliable storms, and surveyed corridors waiting for chairs.',
  price: 350_000,
  baseElev: 1250,
  topElev: 2350,
  ySummit: 170,
  skyline: [
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
  ],
  climate: { snowfallMult: 1, tempOffset: 0, windMult: 1 },
  treeDensity: 1,
  treelineElev: 2100,
  baseDemand: 150,
  entrance: ENTRANCE,
  nodes: [
    { id: 'summit', name: 'Alder Summit', pos: { x: 940, y: 170 }, elevation: 2350, isBase: false },
    { id: 'north-ridge', name: 'North Ridge', pos: { x: 1370, y: 330 }, elevation: 2080, isBase: false },
    { id: 'mid', name: 'Mid Station', pos: { x: 800, y: 560 }, elevation: 1720, isBase: false },
    { id: 'beginner-top', name: 'Meadow Knoll', pos: { x: 470, y: 820 }, elevation: 1420, isBase: false },
    { id: 'beginner-base', name: 'Meadow Base', pos: { x: 560, y: 1010 }, elevation: 1265, isBase: true },
    { id: 'base', name: 'Base Village', pos: { x: 950, y: 1040 }, elevation: 1250, isBase: true },
  ],
  walkEdges: [['beginner-base', 'base']],
  liftSites: [
    {
      id: 'meadow-carpet',
      name: 'Meadow Carpet',
      bottomNodeId: 'beginner-base',
      topNodeId: 'beginner-top',
      allowedKinds: ['surface'],
      prebuilt: 'surface',
    },
    {
      id: 'alder-chair',
      name: 'Alder Chair',
      bottomNodeId: 'base',
      topNodeId: 'mid',
      allowedKinds: ['chair', 'high-speed-chair'],
    },
    {
      id: 'ridge-express',
      name: 'North Ridge Express',
      bottomNodeId: 'mid',
      topNodeId: 'north-ridge',
      allowedKinds: ['chair', 'high-speed-chair'],
    },
    {
      id: 'timber-chair',
      name: 'Timber Chair',
      bottomNodeId: 'mid',
      topNodeId: 'summit',
      allowedKinds: ['chair', 'high-speed-chair'],
    },
    {
      id: 'summit-gondola',
      name: 'Summit Gondola',
      bottomNodeId: 'base',
      topNodeId: 'summit',
      allowedKinds: ['gondola'],
    },
  ],
  trails: [
    {
      id: 'bunny-hollow',
      name: 'Bunny Hollow',
      difficulty: 'green',
      topNodeId: 'beginner-top',
      bottomNodeId: 'beginner-base',
      path: [
        { x: 470, y: 820 },
        { x: 430, y: 900 },
        { x: 480, y: 965 },
        { x: 560, y: 1010 },
      ],
      lengthM: 620,
      verticalM: 155,
      widthM: 45,
      treeCoverage: 0.1,
      scenicAppeal: 0.45,
      riskFactor: 0.7,
      buildCost: 0,
      capacity: 60,
    },
    {
      id: 'pinecone-way',
      name: 'Pinecone Way',
      difficulty: 'green',
      topNodeId: 'beginner-top',
      bottomNodeId: 'base',
      path: [
        { x: 470, y: 820 },
        { x: 560, y: 880 },
        { x: 660, y: 920 },
        { x: 760, y: 980 },
        { x: 870, y: 1020 },
        { x: 950, y: 1040 },
      ],
      lengthM: 1450,
      verticalM: 170,
      widthM: 30,
      treeCoverage: 0.55,
      scenicAppeal: 0.7,
      riskFactor: 0.85,
      buildCost: 0,
      capacity: 70,
    },
    {
      id: 'alder-run',
      name: 'Alder Run',
      difficulty: 'blue',
      topNodeId: 'mid',
      bottomNodeId: 'base',
      path: [
        { x: 800, y: 560 },
        { x: 740, y: 680 },
        { x: 790, y: 800 },
        { x: 880, y: 920 },
        { x: 950, y: 1040 },
      ],
      lengthM: 1750,
      verticalM: 470,
      widthM: 35,
      treeCoverage: 0.35,
      scenicAppeal: 0.6,
      riskFactor: 1,
      buildCost: 18_000,
      capacity: 80,
    },
    {
      id: 'north-ridge-run',
      name: 'North Ridge',
      difficulty: 'blue',
      topNodeId: 'north-ridge',
      bottomNodeId: 'base',
      path: [
        { x: 1370, y: 330 },
        { x: 1430, y: 480 },
        { x: 1380, y: 640 },
        { x: 1280, y: 800 },
        { x: 1130, y: 950 },
        { x: 950, y: 1040 },
      ],
      lengthM: 2600,
      verticalM: 830,
      widthM: 32,
      treeCoverage: 0.25,
      scenicAppeal: 0.9,
      riskFactor: 1.05,
      buildCost: 25_000,
      capacity: 95,
    },
    {
      id: 'timberline',
      name: 'Timberline',
      difficulty: 'black',
      topNodeId: 'summit',
      bottomNodeId: 'mid',
      path: [
        { x: 940, y: 170 },
        { x: 870, y: 300 },
        { x: 900, y: 420 },
        { x: 830, y: 500 },
        { x: 800, y: 560 },
      ],
      lengthM: 1350,
      verticalM: 630,
      widthM: 22,
      treeCoverage: 0.7,
      scenicAppeal: 0.75,
      riskFactor: 1.4,
      buildCost: 30_000,
      capacity: 45,
    },
    {
      id: 'avalanche-chute',
      name: 'Avalanche Chute',
      difficulty: 'double-black',
      topNodeId: 'summit',
      bottomNodeId: 'north-ridge',
      path: [
        { x: 940, y: 170 },
        { x: 1060, y: 220 },
        { x: 1180, y: 250 },
        { x: 1290, y: 300 },
        { x: 1370, y: 330 },
      ],
      lengthM: 950,
      verticalM: 270,
      widthM: 14,
      treeCoverage: 0.15,
      scenicAppeal: 0.85,
      riskFactor: 2.1,
      buildCost: 20_000,
      capacity: 25,
    },
  ],
  prebuiltTrails: ['bunny-hollow', 'pinecone-way'],
  facilitySlots: villageSlots(),
}

// ------------------------------------------------------- the rest of the world

const PRAIRIE: MountainDef = {
  id: 'prairie',
  name: 'Prairie Knob',
  region: 'Upper Midwest, USA',
  blurb: 'Two hundred metres of hill, two million people within an hour. Weak snow, ferocious demand — a snowmaking business with a mountain attached.',
  price: 120_000,
  baseElev: 210,
  topElev: 470,
  ySummit: 620,
  skyline: [
    [0, 760],
    [280, 700],
    [620, 620],
    [900, 632],
    [1240, 668],
    [1600, 714],
    [1920, 752],
  ],
  climate: { snowfallMult: 0.55, tempOffset: -4, windMult: 1.1 },
  treeDensity: 0.85,
  treelineElev: 999,
  clientele: { 'first-timer': 1.7, beginner: 1.4, advanced: 0.5, expert: 0.2 },
  baseDemand: 210,
  entrance: ENTRANCE,
  ...starterZone({ baseElev: 210, knollElev: 310, treeCoverage: 0.3, bunnyVert: 100 }),
  facilitySlots: villageSlots(830),
}

const GRANITE: MountainDef = {
  id: 'granite',
  name: 'Granite Notch',
  region: 'New England, USA',
  blurb: 'Proud East Coast steeps, boilerplate ice, and wind that closes lifts. The locals are loyal and the freeze-thaw is not.',
  price: 260_000,
  baseElev: 400,
  topElev: 1150,
  ySummit: 430,
  skyline: [
    [0, 640],
    [320, 556],
    [700, 470],
    [950, 430],
    [1230, 470],
    [1520, 540],
    [1920, 620],
  ],
  climate: { snowfallMult: 0.7, tempOffset: -2, windMult: 1.4 },
  treeDensity: 0.95,
  treelineElev: 1040,
  clientele: { advanced: 1.2, expert: 1.1, 'first-timer': 0.8 },
  baseDemand: 170,
  entrance: ENTRANCE,
  ...starterZone({ baseElev: 400, knollElev: 600, treeCoverage: 0.5, bunnyVert: 195 }),
  facilitySlots: villageSlots(),
}

const KEA: MountainDef = {
  id: 'kea',
  name: 'Kea Basin',
  region: 'Southern Alps, New Zealand',
  blurb: 'Treeless tussock bowls above a far-away valley. Cheap to cut, savage wind, thin crowds — a blank canvas at the end of the world.',
  price: 700_000,
  baseElev: 1150,
  topElev: 1900,
  ySummit: 340,
  skyline: [
    [0, 560],
    [300, 470],
    [640, 390],
    [900, 340],
    [1180, 380],
    [1480, 450],
    [1920, 548],
  ],
  climate: { snowfallMult: 0.8, tempOffset: 1, windMult: 1.5 },
  treeDensity: 0.05,
  treelineElev: 1000,
  clientele: { advanced: 1.3, expert: 1.4, 'first-timer': 0.4, beginner: 0.7 },
  baseDemand: 110,
  entrance: ENTRANCE,
  ...starterZone({ baseElev: 1150, knollElev: 1320, treeCoverage: 0.05, bunnyVert: 170 }),
  facilitySlots: villageSlots(),
}

const YUKI: MountainDef = {
  id: 'yuki',
  name: 'Yukimura',
  region: 'Hokkaidō, Japan',
  blurb: 'The snowiest place on the list by a mile — metres of dry powder through silver birch. Modest vertical; nobody cares.',
  price: 950_000,
  baseElev: 300,
  topElev: 1150,
  ySummit: 280,
  skyline: [
    [0, 570],
    [380, 470],
    [700, 350],
    [960, 280],
    [1240, 340],
    [1560, 450],
    [1920, 560],
  ],
  climate: { snowfallMult: 2.3, tempOffset: -3, windMult: 0.85 },
  treeDensity: 0.9,
  treelineElev: 1020,
  clientele: { advanced: 1.3, expert: 1.5, 'first-timer': 0.6 },
  baseDemand: 140,
  entrance: ENTRANCE,
  ...starterZone({ baseElev: 300, knollElev: 480, treeCoverage: 0.45, bunnyVert: 180 }),
  facilitySlots: villageSlots(),
}

const ELK: MountainDef = {
  id: 'elk',
  name: 'Elk Spur',
  region: 'Colorado Rockies, USA',
  blurb: 'High, cold, and half above the trees. Interstate crowds arrive every weekend expecting a big mountain — build them one.',
  price: 1_500_000,
  baseElev: 2950,
  topElev: 3950,
  ySummit: 200,
  skyline: [
    [0, 470],
    [250, 380],
    [520, 300],
    [760, 220],
    [1000, 262],
    [1240, 200],
    [1500, 300],
    [1720, 380],
    [1920, 446],
  ],
  climate: { snowfallMult: 1, tempOffset: -5, windMult: 1.2 },
  treeDensity: 0.8,
  treelineElev: 3500,
  clientele: { intermediate: 1.2, advanced: 1.1 },
  baseDemand: 230,
  entrance: ENTRANCE,
  ...starterZone({ baseElev: 2950, knollElev: 3140, treeCoverage: 0.25, bunnyVert: 190 }),
  facilitySlots: villageSlots(),
}

const WASATCH: MountainDef = {
  id: 'wasatch',
  name: 'Wasatch Crown',
  region: 'Wasatch Range, USA',
  blurb: 'The powder cathedral: five hundred inches of featherweight snow on serious terrain, a city at the canyon mouth. Priced accordingly.',
  price: 2_800_000,
  baseElev: 2400,
  topElev: 3500,
  ySummit: 210,
  skyline: [
    [0, 500],
    [300, 400],
    [620, 290],
    [900, 210],
    [1160, 254],
    [1420, 320],
    [1700, 414],
    [1920, 478],
  ],
  climate: { snowfallMult: 1.9, tempOffset: -1, windMult: 1 },
  treeDensity: 0.8,
  treelineElev: 3050,
  clientele: { advanced: 1.4, expert: 1.7, 'first-timer': 0.5, beginner: 0.7 },
  baseDemand: 260,
  entrance: ENTRANCE,
  ...starterZone({ baseElev: 2400, knollElev: 2610, treeCoverage: 0.3, bunnyVert: 210 }),
  facilitySlots: villageSlots(),
}

const BLANCHE: MountainDef = {
  id: 'blanche',
  name: 'Mont Blanche',
  region: 'French Alps',
  blurb: 'Two thousand metres of relief from village vineyards to glacier ice. The fall line is expert terrain almost everywhere — greens are engineering projects. The most famous lift ticket on Earth.',
  price: 5_000_000,
  baseElev: 1100,
  topElev: 3100,
  ySummit: 110,
  skyline: [
    [0, 430],
    [240, 320],
    [500, 214],
    [760, 140],
    [960, 110],
    [1200, 164],
    [1450, 246],
    [1700, 330],
    [1920, 404],
  ],
  climate: { snowfallMult: 0.95, tempOffset: 1, windMult: 1.25 },
  treeDensity: 0.85,
  treelineElev: 2050,
  clientele: { advanced: 1.4, expert: 1.6, 'first-timer': 0.5, beginner: 0.6 },
  baseDemand: 300,
  entrance: ENTRANCE,
  ...starterZone({ baseElev: 1100, knollElev: 1445, treeCoverage: 0.2, bunnyVert: 345 }),
  facilitySlots: villageSlots(),
}

export const LEGACY_MOUNTAIN_MAP: Record<string, MountainDef> = Object.fromEntries(
  [PRAIRIE, GRANITE, ALDER, KEA, YUKI, ELK, WASATCH, BLANCHE].map((m) => [m.id, m]),
)
export const MOUNTAINS: MountainDef[] = Object.values(LEGACY_MOUNTAIN_MAP).map(withHillIdentity)

export const MOUNTAIN_MAP: Record<string, MountainDef> = Object.fromEntries(MOUNTAINS.map((m) => [m.id, m]))

export const DEFAULT_MOUNTAIN_ID = 'alder'

/** what a resort fetches when sold, before development value */
export const RESALE_BASE_RATIO = 0.7
/** how much of the money sunk into lifts/trails/facilities the buyer honours */
export const RESALE_DEVELOPMENT_RATIO = 0.4

/** human-readable snowfall tier for pickers */
export function snowfallLabel(mult: number): string {
  if (mult >= 1.8) return 'Legendary'
  if (mult >= 1.2) return 'Deep'
  if (mult >= 0.9) return 'Solid'
  if (mult >= 0.65) return 'Lean'
  return 'Man-made'
}
