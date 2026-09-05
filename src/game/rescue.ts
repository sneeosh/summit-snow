import { RESCUE_TREATMENT_MINUTES, RESCUE_TRANSPORT_MINUTES } from '../content/balance'
import type { RescueIncident, Vec2 } from './types'

/** Simulation-clock choreography also survives pause, save/load and day skipping. */
export function rescueProgress(incident: RescueIncident, minute: number) {
  const elapsed = Math.max(0, minute - incident.startedMinute)
  const departure = incident.responseMinutes + RESCUE_TREATMENT_MINUTES
  const progress = Math.max(0, Math.min(1, (elapsed - departure) / RESCUE_TRANSPORT_MINUTES))
  const stage = elapsed < incident.responseMinutes ? 'Patrol responding'
    : elapsed < departure ? 'Stabilizing injury'
    : progress < 1 ? (incident.transport === 'helicopter' ? 'Air evacuation' : 'Sled to first aid')
    : 'Transport complete'
  const position: Vec2 = {
    x: incident.location.x + (incident.destination.x - incident.location.x) * progress,
    y: incident.location.y + (incident.destination.y - incident.location.y) * progress,
  }
  return { stage, progress, position, elapsed, departure }
}
