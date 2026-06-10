import { Component } from 'react'
import { reportError } from '@core/sentry.js'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    reportError(error, { 'react.componentStack': info.componentStack })
  }

  render() {
    if (!this.state.error) return this.props.children

    const { label = 'Onderdeel' } = this.props
    return (
      <div style={{
        padding: '24px', margin: '12px',
        background: 'var(--bg2, #111)', border: '1px solid #ef444433',
        borderRadius: 10, color: 'var(--muted, #666)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#ef4444', marginBottom: 6 }}>
          {label} kon niet laden
        </div>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)', opacity: 0.7 }}>
          {this.state.error.message}
        </div>
        <button
          onClick={() => this.setState({ error: null })}
          style={{
            marginTop: 12, fontSize: 12, padding: '5px 12px', borderRadius: 6,
            border: '1px solid var(--border, #333)', background: 'var(--bg3, #1a1a22)',
            color: 'var(--text, #fff)', cursor: 'pointer', fontFamily: 'var(--font-body, sans-serif)',
          }}
        >
          Opnieuw proberen
        </button>
      </div>
    )
  }
}
