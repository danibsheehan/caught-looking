import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children?: ReactNode }

type State = { hasError: boolean; error: Error | null }

/**
 * Catches render errors in lazy route trees so the shell (header/nav) stays visible.
 */
export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RouteErrorBoundary]', error, info?.componentStack)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="route-error" role="alert">
          <h2 className="route-error__title">Something went wrong</h2>
          <p className="route-error__msg">{this.state.error.message}</p>
          <button
            type="button"
            className="route-error__retry"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
