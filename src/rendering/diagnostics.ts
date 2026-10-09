/** Small in-memory diagnostic; never sent until the player submits a report. */
let lastFailure: { message: string; at: string } | null = null
export function recordRenderFailure(error: unknown): void {
  lastFailure = { message: String(error instanceof Error ? error.message : error).slice(0, 1000), at: new Date().toISOString() }
  console.error('[summit-snow] mountain display interrupted', error)
}
export function renderFailure() { return lastFailure }
