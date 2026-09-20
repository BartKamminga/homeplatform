import { useState } from 'react'
import { useConfirm } from '@components/ConfirmDialog.jsx'
import { PhotoThumb } from './PhotoLightbox.jsx'
import { PhotoCard } from './PhotoCard.jsx'

// Item 1168: bij 350+ fotos per wedstrijd was de oude aanpak (elke foto als
// volledige kaart met tags/notitie/knoppen, allemaal tegelijk gerenderd)
// niet meer te doen. Nu: lichte tegels (alleen thumbnail + aanvinkvakje +
// statusbadge), bulk-acties bovenaan voor het gangbare geval (gewoon alles
// publiceren), en de volledige PhotoCard (tags/notitie/los verwijderen)
// alleen nog in een detail-modal wanneer je een tegel openklikt.
function PhotoTile({ photo, selected, onToggleSelect, onOpen }) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={e => { e.stopPropagation(); onToggleSelect(photo.id) }}
        aria-label="Selecteer"
        style={{
          position: 'absolute', top: 4, left: 4, zIndex: 1, width: 22, height: 22, padding: 0,
          borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: selected ? 'none' : '2px solid rgba(255,255,255,.85)',
          background: selected ? '#16a34a' : 'rgba(0,0,0,.35)', color: 'white', fontSize: 13, fontWeight: 700,
        }}
      >
        {selected ? '✓' : ''}
      </button>
      <span style={{
        position: 'absolute', top: 4, right: 4, zIndex: 1, fontSize: 9, fontWeight: 700, padding: '2px 6px',
        borderRadius: 999, color: photo.status === 'published' ? '#065f46' : '#92400e',
        background: photo.status === 'published' ? '#bbf7d0' : '#fde68a',
      }}>
        {photo.status === 'published' ? 'live' : 'concept'}
      </span>
      <a href="#" onClick={e => { e.preventDefault(); onOpen(photo) }} style={{ display: 'block' }}>
        <PhotoThumb photo={photo} />
      </a>
    </div>
  )
}

export function PhotoModerationGrid({ photos, players, entryTitle, onTogglePublish, onDelete, onToggleTag, onSaveCaption, onBulkPublish, onBulkDelete }) {
  const [selected, setSelected] = useState(() => new Set())
  const [openPhoto, setOpenPhoto] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirm, confirmDialog] = useConfirm()

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(photos.map(p => p.id)))
  }
  function deselectAll() {
    setSelected(new Set())
  }

  async function bulkPublish() {
    setBusy(true)
    try {
      await onBulkPublish([...selected])
      setSelected(new Set())
    } finally {
      setBusy(false)
    }
  }

  async function bulkDelete() {
    if (!(await confirm(`${selected.size} foto('s)/filmpje(s) verwijderen? Dit kan niet ongedaan gemaakt worden.`))) return
    setBusy(true)
    try {
      await onBulkDelete([...selected])
      setSelected(new Set())
    } finally {
      setBusy(false)
    }
  }

  // Zodra de lijst ververst (bv. na een bulk-actie) kan een geopende foto
  // niet meer bestaan (verwijderd) - dan de modal gewoon sluiten.
  const stillOpenPhoto = openPhoto && photos.find(p => p.id === openPhoto.id)

  return (
    <div>
      {confirmDialog}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: '#666' }}>{selected.size} geselecteerd van {photos.length}</span>
        <button onClick={selectAll} className="yof-btn-secondary" style={{ fontSize: 12 }}>Selecteer alles</button>
        <button onClick={deselectAll} className="yof-btn-secondary" style={{ fontSize: 12 }} disabled={selected.size === 0}>Deselecteer</button>
        <button onClick={bulkPublish} className="yof-btn-secondary" style={{ fontSize: 12 }} disabled={selected.size === 0 || busy}>
          {busy ? 'Bezig...' : `Publiceer geselecteerd (${selected.size})`}
        </button>
        <button onClick={bulkDelete} className="yof-btn-secondary" style={{ fontSize: 12 }} disabled={selected.size === 0 || busy}>
          Verwijder geselecteerd
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 6 }}>
        {photos.map(p => (
          <PhotoTile key={p.id} photo={p} selected={selected.has(p.id)} onToggleSelect={toggleSelect} onOpen={setOpenPhoto} />
        ))}
      </div>
      {photos.length === 0 && <p style={{ color: '#666', fontSize: 13 }}>Nog geen foto&rsquo;s.</p>}

      {stillOpenPhoto && (
        <div onClick={() => setOpenPhoto(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 340 }}>
            <PhotoCard photo={stillOpenPhoto} players={players} entryTitle={entryTitle}
              onTogglePublish={p => onTogglePublish(p)} onDelete={id => { onDelete(id); setOpenPhoto(null) }}
              onToggleTag={onToggleTag} onSaveCaption={onSaveCaption} />
            <button onClick={() => setOpenPhoto(null)} className="yof-btn" style={{ width: '100%', marginTop: 8 }}>Sluiten</button>
          </div>
        </div>
      )}
    </div>
  )
}
