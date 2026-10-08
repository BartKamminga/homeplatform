import { useState, useEffect } from 'react'
import { setBlockSettings, updateCustomPage } from '../../api.js'
import usePageMeta, { pageMetaId } from './pageMeta.js'

const field = { width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, borderRadius: 8, border: '1px solid #ddd' }
const label = { display: 'block', fontSize: 12, fontWeight: 700, margin: '8px 0 4px' }

// Naam in het menu, icoon, titel en ondertitel van een pagina (item 1248) -
// voor elke pagina, standaard ingeklapt. view = vaste pagina, customPage = eigen pagina.
export default function PageSettingsCard({ view, customPage, onDelete }) {
  const metaOf = usePageMeta()
  const current = customPage || metaOf(view)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) setForm({ label: current.label || '', icon: current.icon || '', title: current.title || '', subtitle: current.subtitle || '' })
  }, [open])

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))
  async function save() {
    setSaving(true)
    setError('')
    try {
      if (customPage) await updateCustomPage(customPage.id, form)
      else await setBlockSettings(pageMetaId(view), form)
      setOpen(false)
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="yof-card" style={{ marginBottom: 16, padding: open ? 14 : '8px 14px' }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 700, width: '100%', textAlign: 'left' }}>
        {open ? '▾' : '▸'} Pagina-instellingen
        <span style={{ fontWeight: 400, color: '#888' }}> &middot; {current.icon ? `${current.icon} ` : ''}{current.label}{current.title ? ` - ${current.title}` : ''}</span>
      </button>
      {open && form && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 90px', gap: 10 }}>
            <div><label style={label}>Naam in het menu</label><input value={form.label} onChange={set('label')} maxLength={30} style={field} /></div>
            <div><label style={label}>Icoon</label><input value={form.icon} onChange={set('icon')} maxLength={8} style={field} /></div>
          </div>
          <label style={label}>Titel</label>
          <input value={form.title} onChange={set('title')} maxLength={80} style={field} />
          <label style={label}>Ondertitel</label>
          <input value={form.subtitle} onChange={set('subtitle')} maxLength={160} style={field} />
          {error && <p style={{ color: '#c23b3b', fontSize: 12 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={save} disabled={saving || !form.label.trim()} className="yof-btn-secondary">{saving ? 'Opslaan...' : 'Opslaan'}</button>
            {onDelete && <button onClick={onDelete} className="yof-btn-secondary">Pagina verwijderen</button>}
          </div>
        </div>
      )}
    </div>
  )
}
