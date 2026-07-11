/**
 * Last line of defence: a crash in one HUD panel must never take down the
 * game (the sim keeps running underneath). Shows a small dismissible card
 * and logs the component stack for diagnosis.
 */
import { Component, type ReactNode } from 'react'

interface Props {
  /** identifies which panel blew up, for the message + logs */
  label: string
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    console.error(`[summit-snow] ${this.props.label} crashed:`, error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="pointer-events-auto absolute left-1/2 top-24 z-50 -translate-x-1/2">
        <div className="glass w-[340px] rounded-2xl border-l-4 !border-l-safety p-3.5">
          <div className="text-[13px] font-semibold">The {this.props.label} hit a bug</div>
          <p className="mt-1 text-[12px] leading-snug text-ink-soft">
            The game is still running. Dismiss this and carry on — and check the console for details.
          </p>
          <button className="btn btn-ghost mt-2" onClick={() => this.setState({ error: null })}>
            Dismiss
          </button>
        </div>
      </div>
    )
  }
}
