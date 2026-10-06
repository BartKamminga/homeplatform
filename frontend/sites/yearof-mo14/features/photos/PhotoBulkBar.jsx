import { useState } from 'react'
import { useConfirm } from '@components/ConfirmDialog.jsx'
import { PHOTO_TYPES } from './photoFilters.js'

// Acties op de selectie (item 1213) - 1 request via /photos/bulk.
// onBulk(action, value) geeft { updated, skipped } terug.

const select = { fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid #ddd', background: 'white', maxWidth: 170 }

// Kiezen in een select voert de actie meteen uit en zet de select terug.
function ActionSelect({ label, options, onPick, disabled }) {
  return (
    <select value="" disabled={disabled} onChange={e => e.target.value && onPick(e.target.value)} style={select}>
      <option value="">{label}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// inArchive = snelfilter Archief: alleen terugzetten of definitief verwijderen.
export default function PhotoBulkBar({ selectedCount, visibleCount, onSelectAll, onDeselect, onBulk, players, entries, lockedMatch, inArchive }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [confirm, confirmDialog] = useConfirm()

  async function run(action, value = null, label = '') {
    if (action === 'archive' && !(await confirm(`${selectedCount} foto('s)/filmpje(s) naar het archief? Ze verdwijnen van de site, maar je kunt ze altijd terugzetten.`))) return
    if (action === 'purge') {
      if (!(await confirm(`${selectedCount} foto('s)/filmpje(s) DEFINITIEF verwijderen? Dit kan niet ongedaan gemaakt worden.`))) return
      if (!(await confirm('Weet je het zeker? De bestanden worden echt gewist.'))) return
    }
    if (action === 'move' && !(await confirm(`${selectedCount} foto('s) verplaatsen naar "${label}"? Foto's die bij een verslag horen blijven staan.`))) return
    setBusy(true)
    setMessage('')
    try {
      const res = await onBulk(action, value)
      const skipped = res?.skipped ? ` · ${res.skipped} overgeslagen (bij een verslag, zonder wedstrijd of niet in het archief)` : ''
      setMessage(`${res?.updated ?? 0} bijgewerkt${skipped}`)
    } catch (e) {
      setMessage(`Mislukt: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  const playerOptions = players.map(p => ({ value: p.id, label: p.nickname || p.name }))
  const none = selectedCount === 0 || busy

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 5, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
      padding: '8px 10px', marginBottom: 10, borderRadius: 10,
      background: selectedCount ? '#12203c' : 'white', color: selectedCount ? 'white' : '#555',
      border: '1px solid #e6e9f0', fontSize: 12,
    }}>
      {confirmDialog}
      <strong>{selectedCount} geselecteerd</strong>
      <button onClick={onSelectAll} className="yof-btn-secondary" style={{ fontSize: 12 }}>Selecteer alle {visibleCount} zichtbare</button>
      {selectedCount > 0 && <button onClick={onDeselect} className="yof-btn-secondary" style={{ fontSize: 12 }}>Deselecteer</button>}
      {selectedCount > 0 && inArchive && (
        <>
          <span style={{ opacity: 0.5 }}>|</span>
          <button disabled={none} onClick={() => run('restore')} className="yof-btn-secondary" style={{ fontSize: 12 }}>Terugzetten</button>
          <button disabled={none} onClick={() => run('purge')} className="yof-btn-secondary" style={{ fontSize: 12, color: '#c23b3b' }}>Definitief verwijderen</button>
        </>
      )}
      {selectedCount > 0 && !inArchive && (
        <>
          <span style={{ opacity: 0.5 }}>|</span>
          <button disabled={none} onClick={() => run('publish')} className="yof-btn-secondary" style={{ fontSize: 12 }}>Publiceren</button>
          <button disabled={none} onClick={() => run('concept')} className="yof-btn-secondary" style={{ fontSize: 12 }}>Naar concept</button>
          <ActionSelect label="Highlight..." disabled={none} onPick={v => run(v)}
            options={[{ value: 'highlight_on', label: 'Highlight aan ⭐' }, { value: 'highlight_off', label: 'Highlight uit' }]} />
          <ActionSelect label="Type..." disabled={none} onPick={v => run('type', v)}
            options={PHOTO_TYPES.map(t => ({ value: t.key, label: t.label }))} />
          <ActionSelect label="Tag speelster..." disabled={none} onPick={v => run('tag', v)} options={playerOptions} />
          <ActionSelect label="Tag weghalen..." disabled={none} onPick={v => run('untag', v)} options={playerOptions} />
          <ActionSelect label={lockedMatch ? 'Verplaats naar andere wedstrijd...' : 'Verplaatsen naar...'} disabled={none}
            onPick={v => run('move', v, entries.find(e => e.match_ref === v)?.title || v)}
            options={entries.filter(e => e.match_ref !== lockedMatch).map(e => ({ value: e.match_ref, label: `${(e.date || '').slice(0, 10)} · ${e.title}` }))} />
          <button disabled={none} onClick={() => run('archive')} className="yof-btn-secondary" style={{ fontSize: 12, color: '#c23b3b' }}>Archiveren</button>
        </>
      )}
      {busy && <span>Bezig...</span>}
      {message && !busy && <span style={{ opacity: 0.85 }}>{message}</span>}
    </div>
  )
}
