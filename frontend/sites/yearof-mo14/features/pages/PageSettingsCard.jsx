import { useState, useEffect } from 'react'
import { setBlockSettings, updateCustomPage } from '../../api.js'
import usePageMeta, { pageMetaId } from './pageMeta.js'
import IconPicker from '../brand/IconPicker.jsx'
import { PageIcon } from '../brand/navIcons.jsx'
import usePageBlocks from '../blocks/usePageBlocks.js'
import { HEADER_STYLES, DEFAULT_HEADER_STYLE, DEFAULT_LIST_STYLE, DEFAULT_HOME_STYLE } from '../matches/matchCardModel.js'
import { CARD_STYLES } from '../players/fifaCardModel.js'

const field = { width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, borderRadius: 8, border: '1px solid #ddd' }
const label = { display: 'block', fontSize: 12, fontWeight: 700, margin: '8px 0 4px' }

// Naam in het menu, icoon, titel en ondertitel van een pagina (item 1248) -
// voor elke pagina, standaard ingeklapt. view = vaste pagina, customPage = eigen pagina.
export default function PageSettingsCard({ view, customPage, onDelete }) {
  const metaOf = usePageMeta()
  const current = customPage || metaOf(view)
  const { setting } = usePageBlocks()
  // Wedstrijden: ook de standaard kopstijl (A/B/C) van een wedstrijdpagina
  const withHeaderStyle = view === 'timeline'
  // Team: standaardstijl van de spelerskaart (speelster van de week = altijd goud tenzij anders gekozen)
  const withCardStyle = view === 'team'
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) setForm({
      label: current.label || '', icon: current.icon || '', title: current.title || '', subtitle: current.subtitle || '',
      ...(withHeaderStyle ? { match_header: setting('page.timeline', 'match_header', DEFAULT_HEADER_STYLE), list_style: setting('page.timeline', 'list_style', DEFAULT_LIST_STYLE), home_style: setting('page.timeline', 'home_style', DEFAULT_HOME_STYLE) } : {}),
      ...(withCardStyle ? { card_style: setting('page.team', 'card_style', 'nacht'), card_goals: setting('page.team', 'card_goals', true) } : {}),
    })
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
        <span style={{ fontWeight: 400, color: '#888', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          &nbsp;&middot; {current.icon && <PageIcon value={current.icon} size={14} />}{current.label}{current.title ? ` - ${current.title}` : ''}
        </span>
      </button>
      {open && form && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 90px', gap: 10 }}>
            <div><label style={label}>Naam in het menu</label><input value={form.label} onChange={set('label')} maxLength={30} style={field} /></div>
            <div><label style={label}>Icoon</label><IconPicker value={form.icon} onChange={icon => setForm(f => ({ ...f, icon }))} /></div>
          </div>
          <label style={label}>Titel</label>
          <input value={form.title} onChange={set('title')} maxLength={80} style={field} />
          <label style={label}>Ondertitel</label>
          <input value={form.subtitle} onChange={set('subtitle')} maxLength={160} style={field} />
          {withCardStyle && (
            <>
              <label style={label}>Spelerskaart - standaardstijl (speelster van de week: goud)</label>
              <select value={form.card_style} onChange={set('card_style')} style={field}>
                {CARD_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginTop: 8 }}>
                <input type="checkbox" checked={form.card_goals !== false} onChange={e => setForm(f => ({ ...f, card_goals: e.target.checked }))} />
                Doelpunten dit seizoen tonen op de spelerskaart
              </label>
            </>
          )}
          {withHeaderStyle && (
            <>
              <label style={label}>Kop van een wedstrijdpagina (standaard, per wedstrijd aan te passen)</label>
              <select value={form.match_header} onChange={set('match_header')} style={field}>
                {HEADER_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <label style={label}>Wedstrijd in de wedstrijdenlijst (standaard, per wedstrijd aan te passen)</label>
              <select value={form.list_style} onChange={set('list_style')} style={field}>
                {HEADER_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <label style={label}>Laatste/volgende wedstrijd op de startpagina (standaard, per wedstrijd aan te passen)</label>
              <select value={form.home_style} onChange={set('home_style')} style={field}>
                {HEADER_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </>
          )}
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
