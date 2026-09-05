import { ensureMountain } from '../content/mountain'
import { HILL_GOALS, type HillMetric } from '../content/hillGoals'
import { foodCapacity, hasFacility, openTrails, patrolCoverage, reachableNodes, runningLifts, staffCount } from './resort'
import { allNodes, getLiftSite, getTrailDef } from './trails'
import type { GameState, Objective } from './types'

export function hillGoals(state: GameState): Objective[] {
  ensureMountain(state.mountainId, state.mountainVersion ?? 1)
  const reach = reachableNodes(state)
  const nodes = allNodes(state)
  const returns = new Set(nodes.filter(n => n.isBase).map(n => n.id))
  const open = openTrails(state)
  // A milestone requires a continuous downhill route home, not an isolated run.
  let grew = true
  while (grew) {
    grew = false
    for (const trail of open) {
      const def = getTrailDef(state, trail.trailId)
      if (returns.has(def.bottomNodeId) && !returns.has(def.topNodeId)) {
        returns.add(def.topNodeId); grew = true
      }
    }
  }
  const usable = open.filter(t => {
    const def = getTrailDef(state, t.trailId)
    return reach.has(def.topNodeId) && returns.has(def.bottomNodeId)
  })
  const base = Math.min(...nodes.filter(n => n.isBase).map(n => n.elevation))
  const metrics: Record<HillMetric, number> = {
    school: Number(hasFacility(state, 'ski-school') && hasFacility(state, 'rental-shop') && staffCount(state, 'instructors') > 0 && staffCount(state, 'rental') > 0),
    groomed: usable.filter(t => getTrailDef(state, t.trailId).difficulty === 'green' && t.surface === 'groomed' && t.groomingPolicy !== 'preserve').length,
    blue: usable.filter(t => getTrailDef(state, t.trailId).difficulty === 'blue').length,
    powder: usable.filter(t => ['black', 'double-black'].includes(getTrailDef(state, t.trailId).difficulty) && t.groomingPolicy === 'preserve').length,
    patrol: usable.length ? Math.min(1, patrolCoverage(state)) : 0,
    lifts: runningLifts(state).filter(l => { const s = getLiftSite(state, l.siteId); return reach.has(s.bottomNodeId) && returns.has(s.topNodeId) }).length,
    food: foodCapacity(state),
    vertical: Math.max(0, ...nodes.filter(n => reach.has(n.id) && returns.has(n.id)).map(n => n.elevation - base)),
  }
  return (HILL_GOALS[state.mountainId] ?? []).map(([metric, target, label]) => {
    const value = metrics[metric]
    return { id: metric, label, progress: Math.min(1, value / target), achieved: value >= target,
      detail: metric === 'patrol' ? `${Math.round(value * 100)}% coverage · current operations` : `${Math.floor(value)} / ${target} · current operations` }
  })
}
