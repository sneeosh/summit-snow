import { ensureMountain } from '../content/mountain'
import { HILL_GOALS, type HillMetric } from '../content/hillGoals'
import { foodCapacity, hasFacility, openTrails, patrolCoverage, runningLifts, staffCount } from './resort'
import { junctionLegsOnTrail } from './junctions'
import { allNodes, getLiftSite, getTrailDef } from './trails'
import type { GameState, Objective } from './types'

export function hillGoals(state: GameState): Objective[] {
  ensureMountain(state.mountainId, state.mountainVersion ?? 1)
  const nodes = allNodes(state)
  const bases = nodes.filter(n => n.isBase).map(n => n.id)
  const reach = new Set(bases), returns = new Set(bases)
  const open = openTrails(state)
  // Split at junctions: a return can merge into another piste partway down.
  const downhill: [string, string][] = []
  for (const trail of open) {
    const def = getTrailDef(state, trail.trailId)
    const stops = [{ nodeId: def.topNodeId, t: 0 }, ...junctionLegsOnTrail(state, trail.trailId), { nodeId: def.bottomNodeId, t: 1 }]
      .filter(stop => Boolean(stop.nodeId)).sort((a, b) => a.t - b.t)
    for (let i = 1; i < stops.length; i++) downhill.push([stops[i - 1].nodeId, stops[i].nodeId])
  }
  const running = runningLifts(state)
  const uphill: [string, string][] = running.map(l => {
    const site = getLiftSite(state, l.siteId)
    return [site.bottomNodeId, site.topNodeId]
  })
  // Lifts plus downhill links reach stations; only downhill links get you home.
  const expand = (set: Set<string>, edges: [string, string][]) => {
    let grew = true
    while (grew) {
      grew = false
      for (const [from, to] of edges) {
        if (set.has(from) && !set.has(to)) { set.add(to); grew = true }
      }
    }
  }
  expand(reach, [...uphill, ...downhill])
  expand(returns, downhill.map(([from, to]) => [to, from]))
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
    lifts: running.filter(l => { const s = getLiftSite(state, l.siteId); return reach.has(s.bottomNodeId) && returns.has(s.topNodeId) }).length,
    food: foodCapacity(state),
    vertical: Math.max(0, ...nodes.filter(n => reach.has(n.id) && returns.has(n.id)).map(n => n.elevation - base)),
  }
  return (HILL_GOALS[state.mountainId] ?? []).map(([metric, target, label]) => {
    const value = metrics[metric]
    return { id: metric, label, progress: Math.min(1, value / target), achieved: value >= target,
      detail: metric === 'patrol' ? `${Math.round(value * 100)}% coverage · current operations` : `${Math.floor(value)} / ${target} · current operations` }
  })
}
