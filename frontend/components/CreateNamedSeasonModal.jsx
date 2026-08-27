import { useState } from 'react'

// Gedeelde "naam + seizoen" aanmaak-popup (item 763) - was letterlijk 2x
// gekopieerd (hockey-inside's CreatePopup, tournix's CreateTournooiPopup),
// alleen de titel/placeholder/onSubmit verschilden.
export default function CreateNamedSeasonModal({ title, namePlaceholder, seasons, defaultSeason, onClose, onCreated, onSubmit }) {
  const [name,   setName]   = useState('')
  const [season, setSeason] = useState(defaultSeason || seasons[seasons.length - 1])
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return setErr('Naam is verplicht')
    setSaving(true)
    setErr('')
    try {
      const created = await onSubmit(name.trim(), season || undefined)
      onCreated(created)
    } catch {
      setErr('Opslaan mislukt')
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'var(--color-surface)', borderRadius: 14, padding: '24px 28px', width: '100%', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18, margin: '0 0 18px' }}>{title}</h2>
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Naam *</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={namePlaceholder}
            style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-background)', color: 'var(--color-text)', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', marginBottom: 14 }}
          />
          <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Seizoen</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {seasons.map(s => (
              <button key={s} type="button" onClick={() => setSeason(s)} style={{
                flex: 1, padding: '7px 4px', borderRadius: 7, fontSize: 11,
                border: season === s ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: season === s ? 'var(--color-primary)' : 'var(--color-bg)',
                color: season === s ? '#fff' : 'var(--color-text)',
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: season === s ? 700 : 400,
              }}>{s}</button>
            ))}
          </div>
          {err && <div style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 8 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'inherit' }}>Annuleren</button>
            <button type="submit" disabled={saving} style={{ padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 500, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'inherit' }}>
              {saving ? 'Opslaan…' : 'Aanmaken'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
