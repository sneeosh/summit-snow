import type { GameState, Guest, GuestVisit, TrailDef } from './types'
import { townBenefits } from './town'
import { getLiftSite, getTrailDef } from './trails'

export const VISIT_GOALS = { learn: 'Build confidence with a lesson and two runs', explore: 'Enjoy four laps of the mountain', challenge: 'Ski three challenging runs', relax: 'Enjoy two runs and a good meal' }
export const VISIT_ORIGINS = { 'day-trip': 'Day trip', inn: 'Village inn', shuttle: 'Village shuttle' }

export function ensureVisit(state: GameState, g: Guest): GuestVisit {
  if (g.visit) return g.visit
  const benefits = townBenefits(state)
  // A deterministic share of actual arrivals uses the village's finite capacity.
  const arrival = state.guestsArrivedToday
  const origin = arrival < benefits.beds && g.id % 3 === 0 ? 'inn'
    : arrival < benefits.transport && g.id % 3 === 1 ? 'shuttle' : 'day-trip'
  const goal = g.skill === 'first-timer' || g.skill === 'beginner' ? 'learn'
    : g.skill === 'expert' || g.skill === 'advanced' ? 'challenge'
    : g.groupType === 'family' || g.groupType === 'couple' ? 'relax' : 'explore'
  g.visit = { goal, origin, steps: [{ minute: g.arrivalMinute, label: `Arrived · ${VISIT_ORIGINS[origin]}` }], lastActivity: 'arriving', fulfilled: false }
  return g.visit
}

export function activityLabel(state: GameState, g: Guest): string {
  if (g.objective === 'resting' && g.hadLesson && g.busyMinutes > 0 && g.memories.at(-1)?.kind === 'great-lesson') return 'Taking a lesson'
  if (g.objective === 'skiing' && g.routeTrailId) return `Skiing ${getTrailDef(state, g.routeTrailId).name}`
  if (g.objective === 'riding' && g.routeLiftId) return `Riding ${getLiftSite(state, g.routeLiftId).name}`
  const labels: Record<string, string> = { arriving: 'Arriving', 'buying-ticket': 'Buying a ticket', renting: 'Collecting rental gear', walking: 'Walking to the next stop', 'to-lift': 'Heading to a lift', queueing: 'Waiting for a lift', eating: 'Stopping for a meal', restroom: 'Restroom stop', resting: 'Warming up', 'first-aid': 'Receiving first aid', rescue: 'Waiting for patrol rescue', leaving: 'Returning to the village', gone: 'Visit complete' }
  return labels[g.objective] ?? g.objective
}

export function recordVisit(state: GameState, g: Guest): void {
  const visit = ensureVisit(state, g)
  visit.notes = g.memories.filter(m => m.delta !== 0).slice(-4).map(m => ({text: m.text, delta: m.delta}))
  if (g.objective === 'leaving' && visit.departureMinute === undefined) visit.departureMinute = state.minute
  const label = activityLabel(state, g)
  if (visit.lastActivity !== label) {
    visit.steps.push({ minute: state.minute, label })
    visit.steps = [visit.steps[0], ...visit.steps.slice(1).slice(-31)]
    visit.lastActivity = label
  }
  const challengeRuns = g.memories.filter(m => m.kind === 'challenge-lap').length
  const complete = visit.goal === 'learn' ? g.hadLesson && g.runsCompleted >= 2
    : visit.goal === 'explore' ? g.runsCompleted >= 4
    : visit.goal === 'challenge' ? challengeRuns >= 3
    : g.runsCompleted >= 2 && g.memories.some(m => m.kind === 'good-meal')
  if (complete && !visit.fulfilled) {
    visit.fulfilled = true
    visit.steps.push({ minute: state.minute, label: '★ Visit goal achieved' })
    g.satisfaction = Math.min(100, g.satisfaction + 5)
  }
}

export function visitTrailPreference(g: Guest, trail: TrailDef): number {
  const goal = g.visit?.goal
  if (goal === 'learn') return trail.difficulty === 'green' ? 1.4 : .7
  if (goal === 'challenge') return trail.difficulty === 'black' || trail.difficulty === 'double-black' ? 1.3 : .8
  if (goal === 'relax') return 1 + trail.scenicAppeal * .5
  return 1
}

export function archiveVisit(state: GameState, g: Guest): void {
  recordVisit(state, g)
  const visit = g.visit!
  visit.steps.push({ minute: state.minute, label: `Headed home · ${Math.round(g.satisfaction)}% satisfaction` })
  state.recentVisits ??= []
  state.recentVisits.push({ id: g.id, name: g.name, satisfaction: g.satisfaction, visit: structuredClone(visit) })
  state.recentVisits = state.recentVisits.slice(-24)
}
