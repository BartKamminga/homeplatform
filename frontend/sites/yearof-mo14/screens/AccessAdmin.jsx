import { useState, useEffect } from 'react'
import { listTeamLinks, createTeamLink, createShortLink } from '../api.js'
import { copyToClipboard } from '../clipboard.js'

export default function AccessAdmin({ onChanged }) {
  const [links, setLinks] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [vangnetDays, setVangnetDays] = useState(10)
  const [shortUrl, setShortUrl] = useState('')

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
      onChanged?.()
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

  useEffect(() => {
    if (!active) { setShortUrl(''); return }
    setShortUrl('')
    createShortLink({ team_code: active.id })
      .then(link => setShortUrl(`${window.location.origin}/l/${link.id}`))
      .catch(() => setShortUrl(`${window.location.origin}/yearof-mo14/?code=${active.id}`))
  }, [active?.id])

  return (
    <div>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      {active ? (
        <div style={{ padding: 12, background: '#fdf8e8', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          <div style={{ marginBottom: 8 }}>
            Code: <strong style={{ fontSize: 16, letterSpacing: '.1em' }}>{active.id}</strong>
            {active.expires_at && <span style={{ color: '#666' }}> &middot; vangnet tot {active.expires_at.slice(0, 10)}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input readOnly value={shortUrl || 'Link maken...'} onFocus={e => e.target.select()}
              style={{ flex: '1 1 260px', padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #ddd' }} />
            <button onClick={() => copyLink(shortUrl)} disabled={!shortUrl} className="yof-btn-secondary">
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
        <button onClick={makeNew} disabled={busy} className="yof-btn-secondary">
          {busy ? 'Bezig...' : 'Vernieuw teamlinkje'}
        </button>
      </div>
    </div>
  )
}
