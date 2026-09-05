/** Optional sandbox milestones, evaluated from the current operating network. */
export type HillMetric = 'school' | 'groomed' | 'blue' | 'powder' | 'patrol' | 'lifts' | 'food' | 'vertical'
export const HILL_GOALS: Record<string, [HillMetric, number, string][]> = {
  prairie: [['school', 1, 'Staff a ski school and rental shop'], ['groomed', 2, 'Maintain two groomed learning runs'], ['food', 24, 'Serve 24 guests at a time']],
  granite: [['groomed', 2, 'Maintain two groomed runs'], ['blue', 2, 'Open two intermediate routes'], ['patrol', 1, 'Fully patrol the open mountain']],
  alder: [['blue', 2, 'Connect two intermediate runs'], ['school', 1, 'Staff the family learning centre'], ['lifts', 3, 'Run three connected lifts']],
  yuki: [['powder', 2, 'Preserve two expert powder runs'], ['groomed', 1, 'Keep a groomed learning route'], ['food', 36, 'Create a welcoming mountain kitchen']],
  kea: [['blue', 2, 'Open two intermediate routes'], ['lifts', 2, 'Operate two connected lifts'], ['patrol', 1, 'Fully patrol the open mountain']],
  elk: [['blue', 3, 'Spread skiers across three blue runs'], ['lifts', 3, 'Operate three connected lifts'], ['food', 48, 'Feed the weekend crowds']],
  wasatch: [['powder', 3, 'Preserve three expert powder runs'], ['patrol', 1, 'Fully patrol the open mountain'], ['groomed', 1, 'Keep a groomed learning route']],
  blanche: [['vertical', 1000, 'Connect 1,000 metres of skiable vertical'], ['lifts', 3, 'Link three operating lifts'], ['food', 48, 'Serve the alpine crowds']],
}
