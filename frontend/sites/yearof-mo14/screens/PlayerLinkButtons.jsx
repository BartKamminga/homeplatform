import { useState } from 'react'
import { createShortLink } from '../api.js'
import { copyToClipboard } from '../clipboard.js'

// Spelerslink voor de Vrienden-van-WhatsApp (item 1186): alleen het profiel
// van deze speelster, geen foto's/verslagen/uitslagen, 10 dagen geldig.
// Hergebruikt een nog geldige link; anders maakt de backend een nieuwe.
export default function PlayerLinkButtons({ playerId, onCreated }) {
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function resolveUrl() {
    const link = await createShortLink({ player_id: playerId })
    const full = `${window.location.origin}/l/${link.id}`
    setUrl(full)
    onCreated?.()
    return full
  }

  async function copy() {
    try {
      await copyToClipboard(await resolveUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      setError(e.message)
    }
  }

  async function open() {
    try {
      window.open(await resolveUrl(), '_blank', 'noopener')
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      <button onClick={copy} className="yof-btn-secondary" title="Voor de Vrienden-van-groep, 10 dagen geldig">
        {copied ? 'Gekopieerd!' : 'Kopieer spelerslink'}
      </button>
      <button onClick={open} className="yof-btn-secondary">Bekijk</button>
      {/* Zichtbaar veld als fallback: clipboard werkt niet altijd zonder https (acc) */}
      {url && <input readOnly value={url} onFocus={e => e.target.select()}
        style={{ fontSize: 11, padding: '3px 5px', borderRadius: 6, border: '1px solid #ddd', width: 150 }} />}
      {error && <span style={{ color: '#c23b3b', fontSize: 11 }}>{error}</span>}
    </div>
  )
}
