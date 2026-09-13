import { useState, useEffect } from 'react'
import { listTeamLinks, createTeamLink } from '../api.js'
import { copyToClipboard } from '../clipboard.js'

export default function AccessAdmin() {
  const [links, setLinks] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  function load() {
    listTeamLinks().then(setLinks).catch(e => setError(e.message))
  }
  useEffect(load, [])

  async function makeNew() {
    setBusy(true)
    try {
      await createTeamLink()
      setCopied(false)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function copyLink(url) {
    try {
      await copyToClipboard(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      setError(e.message)
    }
  }

  const active = links.find(l => !l.revoked_at)
  const shareUrl = active ? `${window.location.origin}/yearof-mo14/?code=${active.id}` : ''

  return (
    <div>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Toegang (teamlinkje)</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      {active ? (
        <div style={{ padding: 12, background: '#fdf8e8', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          <div style={{ marginBottom: 8 }}>
            Code: <strong style={{ fontSize: 16, letterSpacing: '.1em' }}>{active.id}</strong>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input readOnly value={shareUrl} onFocus={e => e.target.select()}
              style={{ flex: '1 1 260px', padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #ddd' }} />
            <button onClick={() => copyLink(shareUrl)} style={{ fontSize: 12, cursor: 'pointer' }}>
              {copied ? 'Gekopieerd!' : 'Kopieer link'}
            </button>
          </div>
          <div style={{ color: '#666', marginTop: 6 }}>
            Plak deze link direct in de WhatsApp-groep — de code wordt automatisch ingevuld.
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: '#666' }}>Nog geen actief teamlinkje.</p>
      )}

      <button onClick={makeNew} disabled={busy} style={{ fontSize: 13, cursor: 'pointer' }}>
        {busy ? 'Bezig...' : 'Vernieuw teamlinkje'}
      </button>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#888' }}>
            <th style={{ padding: 6 }}>Code</th>
            <th style={{ padding: 6 }}>Aangemaakt</th>
            <th style={{ padding: 6 }}>Ingetrokken</th>
          </tr>
        </thead>
        <tbody>
          {links.map(l => (
            <tr key={l.id} style={{ borderTop: '1px solid #eee' }}>
              <td style={{ padding: 6 }}>{l.id}</td>
              <td style={{ padding: 6 }}>{l.created_at?.slice(0, 16).replace('T', ' ')}</td>
              <td style={{ padding: 6 }}>{l.revoked_at ? l.revoked_at.slice(0, 16).replace('T', ' ') : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
