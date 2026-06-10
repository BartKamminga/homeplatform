import React from "react";
import { reportError } from "@core/sentry.js";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    reportError(error, { componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100%", padding: 32, gap: 12,
          color: "var(--text-faint, #888)", textAlign: "center",
        }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text, #222)" }}>
            Er is iets misgegaan
          </div>
          <div style={{ fontSize: 13 }}>
            {this.state.error?.message || "Onbekende fout"}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 8, padding: "8px 20px", borderRadius: 8,
              background: "var(--accent, #6c63ff)", color: "#fff",
              border: "none", cursor: "pointer", fontSize: 13,
            }}
          >
            Opnieuw proberen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
