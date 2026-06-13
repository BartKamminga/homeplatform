import React, { useState, useEffect } from 'react'

export const VERSION = "6.2"
export const CHANGELOG = []

function toEntries(data) {
  return data.map(e => ({
    version: e.version,
    date: new Date(e.released_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }),
    changes: e.description ? e.description.split('\n').filter(Boolean) : [e.title],
  }))
}

export function ChangelogContent() {
  const [changelog, setChangelog] = useState([])

  useEffect(() => {
    fetch('/api/changelog?site=nkhockey')
      .then(r => r.json())
      .then(data => setChangelog(toEntries(data)))
      .catch(() => {})
  }, [])

  if (changelog.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>Laden…</div>
  }

  return (
    <div style={{ maxWidth: 700 }}>
      {changelog.map(e => (
        <div key={e.version} className="card" style={{ marginBottom: 12 }}>
          <div className="card-header" style={{ justifyContent: 'space-between' }}>
            <span>v{e.version}</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{e.date}</span>
          </div>
          <div style={{ padding: '10px 14px' }}>
            {e.changes.map((c, i) => (
              <div key={i} style={{ fontSize: 12.5, color: 'var(--text-secondary)', padding: '3px 0', display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--win)', flexShrink: 0 }}>+</span><span>{c}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
