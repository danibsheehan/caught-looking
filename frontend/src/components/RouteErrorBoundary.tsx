import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ApiError } from '../api/client';

type Props = { children?: ReactNode };

type State = { hasError: boolean; error: Error | null };

/**
 * Catches render errors in lazy route trees so the shell (header/nav) stays visible.
 */
export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const requestId = error instanceof ApiError ? error.requestId : undefined;
    console.error('[RouteErrorBoundary]', error, info?.componentStack, { requestId });
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const err = this.state.error;
      const apiErr = err instanceof ApiError ? err : null;
      return (
        <div className="route-error" role="alert">
          <h2 className="route-error__title">Something went wrong</h2>
          <p className="route-error__msg">{apiErr ? apiErr.apiMessage : err.message}</p>
          {apiErr?.requestId ? (
            <p className="route-error__request-id">
              <span className="route-error__request-id-label">Request ID</span>{' '}
              <code className="route-error__request-id-value">{apiErr.requestId}</code>
            </p>
          ) : null}
          <button
            type="button"
            className="route-error__retry"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
