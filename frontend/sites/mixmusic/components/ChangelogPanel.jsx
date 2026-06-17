import { useState, useEffect } from 'react'
import ChangelogSection from '@components/ChangelogSection.jsx'

function toEntries(data) {
  return data.map(e => ({
    version: e.version,
    date: new Date(e.released_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }),
    changes: e.description ? e.description.split('\n').filter(Boolean) : [e.title],
  }))
}

export default function ChangelogPanel({ onClose }) {
  const [changelog, setChangelog] = useState([])

  useEffect(() => {
    fetch('/api/changelog?site=mixmusic')
      .then(r => r.json())
      .then(data => setChangelog(toEntries(data)))
      .catch(() => {})
  }, [])

  const version = changelog[0]?.version ?? '…'

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(0,0,0,0.3)' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 60,
        width: 300, background: 'var(--bg)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, padding: '4px', marginRight: 10, lineHeight: 1 }}>←</button>
          <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Over Mix Music</span>
        </div>
        <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto' }}>
          <ChangelogSection changelog={changelog} version={`Mix Music v${version}`} />
        </div>
      </div>
    </>
  )
}
