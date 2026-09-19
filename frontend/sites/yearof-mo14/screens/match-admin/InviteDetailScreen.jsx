import { useState } from 'react'
import { deleteContributorLink } from '../../api.js'
import { copyToClipboard } from '../../clipboard.js'
import { contributorLinkStatus } from '../../linkStatus.js'
import { useConfirm } from '@components/ConfirmDialog.jsx'

export const INVITE_TYPE_LABEL = { wedstrijdverslag: 'Wedstrijdverslag', interview: 'Interview', foto: "Foto's" }

// Focust op 1 specifiek invullinkje (niet de hele lijst) - vanuit de
// placeholder-kaart in de preview, zodat "editen" over dat ene linkje gaat.
export function InviteDetailScreen({ link, players, onBack, onDeleted, onFill }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [confirm, confirmDialog] = useConfirm()

  if (!link) {
    return (
      <div style={{ marginBottom: 24 }}>
        <button onClick={onBack} style={{ fontSize: 12, cursor: 'pointer', marginBottom: 12 }}>&larr; terug</button>
        <p style={{ fontSize: 13, color: '#666' }}>Dit invullinkje bestaat niet meer.</p>
      </div>
    )
  }

  const status = contributorLinkStatus(link)
  const url = `${window.location.origin}/yearof-mo14/?invul=${link.id}`
  const forWhom = link.player_id
    ? (players.find(p => p.id === link.player_id)?.nickname || players.find(p => p.id === link.player_id)?.name || 'speelster')
    : 'het team'

  async function copy() {
    try {
      await copyToClipboard(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      setError(e.message)
    }
  }

  async function remove() {
    if (!(await confirm('Dit invullinkje verwijderen? Dit kan niet ongedaan gemaakt worden.'))) return
    try {
      await deleteContributorLink(link.id)
      onDeleted()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      {confirmDialog}
      <button onClick={onBack} style={{ fontSize: 12, cursor: 'pointer', marginBottom: 12 }}>&larr; terug</button>
      <h3 style={{ fontSize: 15, margin: '0 0 4px' }}>{INVITE_TYPE_LABEL[link.report_type] || link.report_type} &middot; {forWhom}</h3>
      <p style={{ fontSize: 13, fontWeight: 600, color: status.color, margin: '0 0 14px' }}>{status.label}</p>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Invullinkje</label>
      <input readOnly value={url} onFocus={e => e.target.select()}
        style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', marginBottom: 10 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={copy} className="yof-btn" style={{ flex: 1 }}>{copied ? 'Gekopieerd!' : 'Kopieer'}</button>
        <button onClick={onFill} className="yof-btn"
          style={{ flex: 1, background: 'transparent', border: '1px solid #ddd', color: 'inherit' }}>Zelf invullen</button>
      </div>
      <button onClick={remove} className="yof-btn-secondary">Verwijderen</button>
    </div>
  )
}
