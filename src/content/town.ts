import type { TownProject, TownSeat } from '../game/types'
export const TOWN_SEATS: TownSeat[] = ['residents', 'businesses', 'conservation']
export const TOWN_SEAT_LABELS = { residents: 'Residents’ representative', businesses: 'Business association', conservation: 'Conservation councillor' }
export const TOWN_PROJECTS: Record<TownProject, { name: string; cost: number; days: number; votes: Record<TownSeat, number>; trust: Record<TownSeat, number>; benefit: string }> = {
 inn: { name: 'Village inn', cost: 65_000, days: 4, votes: { residents: -18, businesses: 18, conservation: -12 }, trust: { residents: -6, businesses: 5, conservation: -4 }, benefit: '48 visitor beds and more daily demand per level. Residents want staff housing before more tourism.' },
 housing: { name: 'Employee homes', cost: 35_000, days: 3, votes: { residents: 18, businesses: 6, conservation: -5 }, trust: { residents: 5, businesses: 3, conservation: -1 }, benefit: 'Homes for workers reduce staffing costs by 3.5% per level and build resident support.' },
 shuttle: { name: 'Village shuttle', cost: 24_000, days: 2, votes: { residents: 8, businesses: -5, conservation: 18 }, trust: { residents: 3, businesses: 1, conservation: 5 }, benefit: '80 more daily arrivals through transport capacity per level. A cleaner alternative to more car parks.' },
 mainstreet: { name: 'Main-street renewal', cost: 18_000, days: 2, votes: { residents: 6, businesses: 12, conservation: 3 }, trust: { residents: 3, businesses: 4, conservation: 2 }, benefit: 'Shops, public space and festivals add 5% to visitor demand per level.' },
}
export const TOWN_PROJECT_ORDER: TownProject[] = ['housing', 'shuttle', 'mainstreet', 'inn']
export const TOWN_REGION_PRESSURE: Record<string, number> = { prairie: -2, granite: 0, alder: 0, yuki: 6, kea: 8, elk: 3, wasatch: 5, blanche: 8 }

export const TOWN_POLICIES = {
 winterMarket: { name: 'Winter market charter', benefit: 'Season-long market stalls and 3% additional demand; $60 daily upkeep. Requires Main Street.', votes: { residents: 8, businesses: 15, conservation: -8 } },
 darkSky: { name: 'Dark-sky village', benefit: 'Shielded amber lamps and softer village evenings; 20% lower town service costs.', votes: { residents: 10, businesses: -8, conservation: 20 } },
}
export const TOWN_IDENTITIES: Record<string, { roof: 'brick'|'slate'|'timber'|'onsen'|'modern'|'western'|'stone'|'chalet'; landmark: string; color: string }> = {
 prairie: { roof: 'brick', landmark: 'Millpond skating club', color: '#a95746' },
 granite: { roof: 'slate', landmark: 'Quarry clock square', color: '#925443' },
 alder: { roof: 'timber', landmark: 'Cedar boardwalk', color: '#507066' },
 yuki: { roof: 'onsen', landmark: 'Lantern spring', color: '#906f59' },
 kea: { roof: 'modern', landmark: 'Lakeside lookout', color: '#7b8471' },
 elk: { roof: 'western', landmark: 'Aspen gathering circle', color: '#b7844e' },
 wasatch: { roof: 'stone', landmark: 'Canyon bouldering garden', color: '#858b98' },
 blanche: { roof: 'chalet', landmark: 'Café des Neiges terrace', color: '#758da0' },
}
