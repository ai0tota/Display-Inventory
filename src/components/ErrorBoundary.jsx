import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error(error, errorInfo.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-md mx-auto mt-20 p-6 card">
          <h1 className="signboard text-lg">This screen hit a problem</h1>
          <p className="text-sm text-ink-45 mt-2">
            The rest of the app still works. Reload to try again.
          </p>
          <pre className="mt-4 p-3 rounded-lg bg-paper-sunk text-xs text-gulal overflow-x-auto whitespace-pre-wrap">
            {this.state.error?.message || this.state.error?.toString()}
          </pre>
          <button className="btn-primary mt-4" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
