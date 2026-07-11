/** Scenario objective tracking, evaluated at each day end. */
import { OBJ_GUESTS_IN_DAY, OBJ_MAX_SERIOUS_INCIDENTS, OBJ_SATISFACTION_TARGET } from '../content/balance'
import { TRAIL_MAP } from '../content/mountain'
import type { DailyReport, GameState } from './types'

export function updateObjectives(state: GameState, report: DailyReport, seasonIncidents: number): void {
  if (state.mode !== 'scenario') return

  for (const obj of state.objectives) {
    switch (obj.id) {
      case 'satisfaction': {
        if (report.guestsServed >= 20 && report.avgSatisfaction >= OBJ_SATISFACTION_TARGET) obj.achieved = true
        const best = Math.max(report.avgSatisfaction, parseFloat(obj.detail.split(': ')[1]) || 0)
        obj.progress = Math.min(1, best / OBJ_SATISFACTION_TARGET)
        obj.detail = `Best day so far: ${best.toFixed(0)}%`
        break
      }
      case 'guests': {
        if (report.guestsServed >= OBJ_GUESTS_IN_DAY) obj.achieved = true
        const best = Math.max(report.guestsServed, parseInt(obj.detail.split(': ')[1]) || 0)
        obj.progress = Math.min(1, best / OBJ_GUESTS_IN_DAY)
        obj.detail = `Best day so far: ${best}`
        break
      }
      case 'profit': {
        if (report.netProfit > 0) obj.achieved = true
        if (obj.achieved) {
          obj.progress = 1
          obj.detail = 'Achieved'
        } else {
          obj.detail = `Yesterday: ${report.netProfit < 0 ? '−' : ''}$${Math.abs(report.netProfit).toLocaleString()}`
        }
        break
      }
      case 'blue-trail': {
        const anyBlue = Object.values(state.trails).some(
          (t) => t.built && t.open && TRAIL_MAP[t.trailId].difficulty === 'blue',
        )
        if (anyBlue) {
          obj.achieved = true
          obj.progress = 1
          obj.detail = 'Achieved'
        }
        break
      }
      case 'safety': {
        obj.achieved = seasonIncidents < OBJ_MAX_SERIOUS_INCIDENTS
        obj.progress = obj.achieved ? 1 : 0
        obj.detail = `${seasonIncidents} serious incident${seasonIncidents === 1 ? '' : 's'}`
        break
      }
    }
  }

  state.scenarioComplete = state.objectives.every((o) => o.achieved)
}
