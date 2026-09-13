import { useState, useEffect } from 'react'
import { listTeamLinks, createTeamLink } from '../api.js'
import { copyToClipboard } from '../clipboard.js'

export default function AccessAdmin() {
  const [links, setLinks] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [vangnetDays, setVangnetDays] = useState(10)

  function load() {
    listTeamLinks().then(setLinks).catch(e => setError(e.message))
  }
  useEffect(load, [])

  async function makeNew() {
    setBusy(true)
    try {
      await createTeamLink(vangnetDays)
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

  function isExpired(l) {
    return l.expires_at && new Date(l.expires_at) < new Date()
  }

  const active = links.find(l => !l.revoked_at && !isExpired(l))
  const shareUrl = active ? `${window.location.origin}/yearof-mo14/?code=${active.id}` : ''

  return (
    <div>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Teamlinkje</h3>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
        De site is sinds kort open voor iedereen - dit linkje is niet meer nodig om te kunnen bekijken.
        Handig om toch te delen als je wilt.
      </p>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      {active ? (
        <div style={{ padding: 12, background: '#fdf8e8', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          <div style={{ marginBottom: 8 }}>
            Code: <strong style={{ fontSize: 16, letterSpacing: '.1em' }}>{active.id}</strong>
            {active.expires_at && <span style={{ color: '#666' }}> &middot; vangnet tot {active.expires_at.slice(0, 10)}</span>}
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

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: '#666' }}>
          Vangnet (dagen):
          <input type="number" min={1} value={vangnetDays} onChange={e => setVangnetDays(Number(e.target.value) || 10)}
            style={{ width: 50, marginLeft: 6, fontSize: 12, padding: '3px 5px' }} />
        </label>
        <button onClick={makeNew} disabled={busy} style={{ fontSize: 13, cursor: 'pointer' }}>
          {busy ? 'Bezig...' : 'Vernieuw teamlinkje'}
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#888' }}>
            <th style={{ padding: 6 }}>Code</th>
            <th style={{ padding: 6 }}>Aangemaakt</th>
            <th style={{ padding: 6 }}>Vangnet</th>
            <th style={{ padding: 6 }}>Ingetrokken</th>
          </tr>
        </thead>
        <tbody>
          {links.map(l => (
            <tr key={l.id} style={{ borderTop: '1px solid #eee' }}>
              <td style={{ padding: 6 }}>{l.id}</td>
              <td style={{ padding: 6 }}>{l.created_at?.slice(0, 16).replace('T', ' ')}</td>
              <td style={{ padding: 6, color: isExpired(l) ? '#c23b3b' : 'inherit' }}>
                {l.expires_at ? l.expires_at.slice(0, 10) + (isExpired(l) ? ' (verlopen)' : '') : '-'}
              </td>
              <td style={{ padding: 6 }}>{l.revoked_at ? l.revoked_at.slice(0, 16).replace('T', ' ') : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
