import { useState, useEffect } from 'react'
import { listTeamLinks, createTeamLink } from '../api.js'

export default function AccessAdmin() {
  const [links, setLinks] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function load() {
    listTeamLinks().then(setLinks).catch(e => setError(e.message))
  }
  useEffect(load, [])

  async function makeNew() {
    setBusy(true)
    try {
      await createTeamLink()
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const active = links.find(l => !l.revoked_at)
  const publicBase = window.location.origin + '/yearof-mo14/'

  return (
    <div>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Toegang (teamlinkje)</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      {active ? (
        <div style={{ padding: 12, background: '#fdf8e8', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          Huidige code: <strong style={{ fontSize: 16, letterSpacing: '.1em' }}>{active.id}</strong>
          <div style={{ color: '#666', marginTop: 4 }}>Deel dit met de teamcode-vraag: {publicBase} + code &ldquo;{active.id}&rdquo;</div>
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
