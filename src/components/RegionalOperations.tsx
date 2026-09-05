import { AVALANCHE_CONTROL_COST_PER_RUN, AVALANCHE_CONTROL_STAFF, AVALANCHE_MOUNTAINS, NIGHT_LIGHTING_COST } from '../content/balance'
import { avalancheHeld, avalancheRisk, avalancheRuns, closingMinute } from '../game/operations'
import { getTrailDef } from '../game/trails'
import { formatClock, formatMoney, useStore } from '../state/store'

export function RegionalOperations() {
  const game = useStore(s => s.game)!
  const install = useStore(s => s.installNightLighting)
  const night = useStore(s => s.setNightSkiing)
  const control = useStore(s => s.controlAvalanches)
  const reopen = useStore(s => s.setTrailOpen)
  const planning = game.phase === 'planning'
  const pending = avalancheRuns(game).filter(id => avalancheHeld(game, id))
  return <div className="scroll-thin h-full space-y-2 overflow-y-auto p-3 text-[12px]">
    <div className="flex justify-between font-semibold"><span>Mountain operations</span><span>Closes {formatClock(closingMinute(game))}</span></div>
    {game.mountainId === 'prairie' && <>
      <p>Floodlit laps after work. Evening operations add arrivals, four hours of payroll and lift energy, plus lighting costs.</p>
      {!game.operations.nightLighting
        ? <button className="btn btn-primary" disabled={!planning || game.cash < NIGHT_LIGHTING_COST} onClick={install}>Install floodlights · {formatMoney(NIGHT_LIGHTING_COST)}</button>
        : <label className="flex items-center gap-2"><input type="checkbox" disabled={!planning} checked={game.operations.nightSkiing} onChange={e => night(e.target.checked)} />Night skiing until 8:30 p.m.</label>}
    </>}
    {AVALANCHE_MOUNTAINS.includes(game.mountainId) && <>
      <p>Recent storms, wind loading and thaw can place expert runs on hold. Control requires {AVALANCHE_CONTROL_STAFF} patrollers and lasts for today. Reopen cleared runs when snow cover permits.</p>
      {pending.length > 0 && <button className="btn btn-primary" disabled={!planning} onClick={control}>Control {pending.length} runs · {formatMoney(pending.length * AVALANCHE_CONTROL_COST_PER_RUN)}</button>}
      {Object.values(game.trails).filter(t => t.built && ['black', 'double-black'].includes(getTrailDef(game,t.trailId).difficulty)).map(t => <div key={t.trailId} className="flex items-center justify-between gap-2 border-t border-ink/10 pt-1">
        <span>{getTrailDef(game,t.trailId).name} · {avalancheHeld(game,t.trailId) ? 'Avalanche hold' : avalancheRisk(game,t.trailId) === 'high' ? 'Control complete' : `${avalancheRisk(game,t.trailId)} risk`}</span>
        {!t.open && !avalancheHeld(game,t.trailId) && <button className="btn btn-ghost" onClick={() => reopen(t.trailId,true)}>Reopen</button>}
      </div>)}
      {!pending.length && <p className="text-ink-faint">No outstanding avalanche-control work.</p>}
    </>}
    {game.mountainId !== 'prairie' && !AVALANCHE_MOUNTAINS.includes(game.mountainId) && <p>Daytime operations. Keep rentals and food venues staffed to welcome the village crowd; use each trail’s grooming plan to choose corduroy or natural snow.</p>}
    {!planning && <p className="text-ink-faint">Choose shifts and complete control work before opening tomorrow.</p>}
  </div>
}
