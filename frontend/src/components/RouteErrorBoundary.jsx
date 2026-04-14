import { Component } from 'react'

/**
 * Catches render errors in lazy route trees so the shell (header/nav) stays visible.
 */
export default class RouteErrorBoundary extends Component {
  /** @type {{ hasError: boolean, error: Error | null }} */
  state = { hasError: false, error: null }

  /** @param {Error} error */
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  /**
   * @param {Error} error
   * @param {{ componentStack?: string }} info
   */
  componentDidCatch(error, info) {
    console.error('[RouteErrorBoundary]', error, info?.componentStack)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="route-error" role="alert">
          <h2 className="route-error-title">Something went wrong</h2>
          <p className="route-error-msg">{this.state.error.message}</p>
          <button
            type="button"
            className="route-error-retry"
            onClick={() =>
              this.setState({ hasError: false, error: null })
            }
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
