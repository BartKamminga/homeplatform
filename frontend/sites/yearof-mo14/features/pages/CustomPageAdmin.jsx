import { useState, useEffect } from 'react'
import { updateCustomPage, deleteCustomPage } from '../../api.js'
import { useConfirm } from '@components/ConfirmDialog.jsx'
import MatchAdminDetail from '../../screens/match-admin/index.jsx'
import PageBlock from '../blocks/PageBlock.jsx'
import PageSwitch from '../blocks/PageSwitch.jsx'
import useCustomPages, { pageRef } from './useCustomPages.js'
import { PageHero } from './CustomPage.jsx'

const field = { width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, borderRadius: 8, border: '1px solid #ddd' }
const label = { display: 'block', fontSize: 12, fontWeight: 700, margin: '8px 0 4px' }

// Eigen pagina in de beheerstudio (item 1239): live/concept, menunaam en kop,
// en de berichten/foto's zoals op een wedstrijdpagina (zonder wedstrijd erachter).
export default function CustomPageAdmin({ pageId, onDeleted }) {
  const page = useCustomPages().find(p => p.id === pageId)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirm, confirmDialog] = useConfirm()

  useEffect(() => {
    if (page && !form) setForm({ label: page.label, title: page.title || '', subtitle: page.subtitle || '', icon: page.icon || '' })
  }, [page])

  if (!page || !form) return null
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  async function save() {
    setSaving(true)
    setError('')
    try { await updateCustomPage(page.id, form) } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  async function remove() {
    if (!(await confirm(`Pagina "${page.label}" verwijderen? Hij verdwijnt uit het menu; de berichten en foto's blijven bewaard maar zijn niet meer zichtbaar.`))) return
    await deleteCustomPage(page.id)
    onDeleted()
  }

  return (
    <div>
      {confirmDialog}
      <PageSwitch id={`page.${page.id}`} label={page.label} />

      <div className="yof-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 90px', gap: 10 }}>
          <div><label style={label}>Naam in het menu</label><input value={form.label} onChange={set('label')} maxLength={30} style={field} /></div>
          <div><label style={label}>Icoon</label><input value={form.icon} onChange={set('icon')} maxLength={8} placeholder="🗼" style={field} /></div>
        </div>
        <label style={label}>Titel in de kop</label>
        <input value={form.title} onChange={set('title')} maxLength={80} style={field} />
        <label style={label}>Ondertitel</label>
        <input value={form.subtitle} onChange={set('subtitle')} maxLength={160} style={field} />
        {error && <p style={{ color: '#c23b3b', fontSize: 12 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={save} disabled={saving || !form.label.trim()} className="yof-btn-secondary">{saving ? 'Opslaan...' : 'Opslaan'}</button>
          <button onClick={remove} className="yof-btn-secondary">Pagina verwijderen</button>
        </div>
      </div>

      <PageBlock id={`hero.${page.id}`} label="Kop" editMode><PageHero page={page} /></PageBlock>
      <MatchAdminDetail key={page.id} matchRef={pageRef(page.id)} pinnedPage pageTitle={page.label} />
    </div>
  )
}
