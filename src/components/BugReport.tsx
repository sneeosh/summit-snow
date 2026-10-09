import { useEffect, useState } from 'react'
import { GAME_VERSION } from '../content/releases'
import { renderFailure } from '../rendering/diagnostics'
import { useStore } from '../state/store'

/** Outside the HUD error boundary: reporting survives a broken map or HUD. */
export function BugReport() {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [download, setDownload] = useState('')
  useEffect(() => () => { if (download) URL.revokeObjectURL(download) }, [download])
  const show = () => {
    useStore.getState().setSpeed(0)
    setOpen(true)
    setStatus('')
    // Snapshot at open time, before any async submission or further play.
    const s = useStore.getState()
    setDownload(URL.createObjectURL(new Blob([JSON.stringify({ version: GAME_VERSION, game: s.game, error: renderFailure() })], { type: 'application/json' })))
  }
  const submit = async () => {
    setBusy(true)
    setStatus('')
    try {
      const s = useStore.getState()
      const response = await fetch('/api/feedback', {
        method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, diagnostics: JSON.stringify({
          version: GAME_VERSION, mountain: s.game?.mountainId, day: s.game?.day,
          seed: s.game?.seed, phase: s.game?.phase, view: s.worldView,
          error: renderFailure(), browser: navigator.userAgent,
          viewport: `${innerWidth}x${innerHeight}@${devicePixelRatio}`,
        }) }),
      })
      if (response.status !== 201) throw new Error('Report could not be sent. Your text is still here; please try again or download the diagnostic save.')
      setStatus('Report sent. Thank you!')
      setDescription('')
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Report could not be sent.') }
    finally { setBusy(false) }
  }
  return <>
    <button className="pointer-events-auto absolute bottom-16 right-3 z-[60] rounded-xl bg-white px-3 py-2 text-xs font-semibold text-ink shadow" onClick={show}>Report a bug</button>
    {open && <div className="pointer-events-auto absolute inset-0 z-[70] flex items-center justify-center bg-ink/40 p-4" onKeyDown={e => e.stopPropagation()}>
      <section role="dialog" aria-modal="true" aria-labelledby="bug-report-title" className="glass max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl p-5">
        <h2 id="bug-report-title" className="font-display text-xl">Report a bug</h2>
        <label className="mt-3 block text-sm">What happened?
          <textarea autoFocus className="mt-2 block min-h-32 w-full rounded-lg border bg-white p-2" value={description} maxLength={4000} onChange={e => setDescription(e.target.value)} />
        </label>
        <p className="my-3 text-xs">Your description, game version, browser details and latest display error will be posted to our public GitHub issue tracker. Please leave out personal information.</p>
        <a className="text-sm underline" href={download} download="summit-snow-diagnostic.json">Download diagnostic save</a>
        <p className="text-xs">The save stays on your device unless you choose to share it.</p>
        <p role="status" className="my-3 text-sm">{status}</p>
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={busy || description.trim().length < 5} onClick={submit}>{busy ? 'Sending…' : 'Send report'}</button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => setOpen(false)}>Close</button>
        </div>
      </section>
    </div>}
  </>
}
