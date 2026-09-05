import { useEffect } from 'react'
import { BottomPanel } from './components/BottomPanel'
import { DailyReportModal } from './components/DailyReport'
import { DrawTrailPanel } from './components/DrawTrailPanel'
import { ErrorBoundary } from './components/ErrorBoundary'
import { EventsUI } from './components/EventsUI'
import { Inspector } from './components/Inspector'
import { LeftRail } from './components/LeftRail'
import { MainMenu } from './components/Menu'
import { Objectives } from './components/Objectives'
import { Toast } from './components/Toast'
import { TownView } from './components/TownView'
import { TopBar } from './components/TopBar'
import { Tutorial } from './components/Tutorial'
import { MountainCanvas } from './rendering/MountainCanvas'
import { startGameLoop, useStore } from './state/store'

export default function App() {
  const worldView = useStore(s => s.worldView)
  const screen = useStore((s) => s.screen)
  const mountainId = useStore((s) => s.game?.mountainId)

  useEffect(() => {
    startGameLoop()
  }, [])

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState()
      if (s.screen !== 'playing' || !s.game) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.target instanceof HTMLElement && e.target.closest('button, a, [contenteditable="true"]')) return
      switch (e.key) {
        case ' ':
          e.preventDefault()
          s.setSpeed(s.speed === 0 ? 1 : 0)
          break
        case '1':
          s.setSpeed(1)
          break
        case '2':
          s.setSpeed(4)
          break
        case 'Escape':
          if (s.buildMode) s.setBuildMode(null)
          else if (s.selection) s.select(null)
          break
        case 'Backspace':
          if (s.buildMode?.type === 'draw-trail') {
            e.preventDefault()
            s.undoDrawPoint()
          }
          break
        case 'Enter':
          if (s.buildMode?.type === 'draw-trail' && s.buildMode.points.length >= 2) {
            e.preventDefault()
            s.confirmDrawTrail()
          }
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (screen === 'menu') return <MainMenu />

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-snow-1">
      {/* keyed by mountain: switching resorts rebuilds the whole Pixi scene */}
      {worldView === 'mountain' && <MountainCanvas key={mountainId ?? 'none'} />}
      <div className="pointer-events-none absolute inset-0">
        <ErrorBoundary label="HUD">
          <TopBar />
          {worldView === 'mountain' ? <><LeftRail /><Inspector /></> : <TownView key={mountainId} />}
          <BottomPanel />
          {worldView === 'mountain' && <><Objectives /><Tutorial /></>}
          <EventsUI />
          <BuildModeHint />
          <DrawTrailPanel />
          <DailyReportModal />
          <GameOverBanner />
          <Toast />
        </ErrorBoundary>
      </div>
    </div>
  )
}

function BuildModeHint() {
  const buildMode = useStore((s) => s.buildMode)
  const setBuildMode = useStore((s) => s.setBuildMode)
  if (!buildMode || buildMode.type === 'draw-trail') return null // draw mode has its own panel
  const label =
    buildMode.type === 'draw-lift'
      ? buildMode.first === null
        ? 'Click the BOTTOM terminal — anywhere on the mountain (rings snap to stations)'
        : 'Now click the TOP terminal — the label shows live cost and warnings'
      : buildMode.type === 'trail'
        ? 'Click a dotted corridor to cut the trail'
        : buildMode.type === 'snowmaking'
          ? 'Click a built trail to install snow guns'
          : 'Click a highlighted site in the village'
  return (
    <div className="pointer-events-auto absolute left-1/2 top-[74px] z-20 -translate-x-1/2">
      <div className="glass flex items-center gap-3 rounded-xl px-3.5 py-1.5 text-[12px] font-semibold text-ink-soft rise-in">
        <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-wood" />
        {label}
        <button className="text-ink-faint underline-offset-2 hover:underline" onClick={() => setBuildMode(null)}>
          cancel (esc)
        </button>
      </div>
    </div>
  )
}

function GameOverBanner() {
  const game = useStore((s) => s.game)
  const showReport = useStore((s) => s.showReport)
  const toMenu = useStore((s) => s.toMenu)
  if (!game || !game.gameOver || showReport) return null
  const bankrupt = game.cash < -10000
  return (
    <div className="fade-in pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-ink/35 backdrop-blur-[2px]">
      <div className="glass w-[440px] rounded-3xl p-7 text-center rise-in">
        <h2 className="font-display text-[30px] font-semibold">{bankrupt ? 'Foreclosed' : 'Season’s end'}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
          {bankrupt
            ? 'The overdraft ran too deep and the bank took the keys to the mountain.'
            : game.scenarioComplete
              ? 'Every objective met. Mount Alder is the story of the valley — and next winter is yours to write.'
              : 'The lifts stop, the snow settles, and the mountain waits for next winter.'}
        </p>
        <div className="mt-3 text-[12px] text-ink-faint">
          {game.totalGuestsSeason.toLocaleString()} guests this season · reputation {game.reputation.toFixed(1)}★
        </div>
        <button className="btn btn-primary mt-5" onClick={toMenu}>
          Back to menu
        </button>
      </div>
    </div>
  )
}
