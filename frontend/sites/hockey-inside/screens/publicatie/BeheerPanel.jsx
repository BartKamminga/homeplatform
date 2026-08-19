import { KNOWN_SEASONS } from '../../api.js'
import { card, cardLabel, ghostBtn, inputStyle } from '../styles.js'

// ── ⚙ Beheer meta-paneel (item 635, uitgesplitst uit CompetitiesTab item 737) ──

export default function BeheerPanel({
  metaOpen, toggleMetaOpen,
  published, onTogglePublished,
  season, setSeason,
  globalTags, onRequestDeleteTag,
  newTagName, setNewTagName, addingTag, onAddTag,
  onDelete, confirmDel, setConfirmDel, deleting, onConfirmDelete,
}) {
  return (
    <div style={card}>
      <div
        onClick={toggleMetaOpen}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', flex: 1 }}>⚙ Beheer</span>
        {!metaOpen && (
          <>
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 99, fontWeight: 600,
              background: published ? 'color-mix(in srgb, var(--color-success) 15%, var(--color-surface))' : 'color-mix(in srgb, var(--color-warning) 15%, var(--color-surface))',
              color: published ? 'var(--color-success)' : 'var(--color-warning)',
            }}>
              {published ? '● Zichtbaar' : '○ Concept'}
            </span>
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
              {season}
            </span>
            {globalTags.length > 0 && (
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{globalTags.length} tags</span>
            )}
          </>
        )}
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{metaOpen ? '▾' : '▸'}</span>
      </div>

      {metaOpen && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Zichtbaar + verwijderen */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {onTogglePublished && (
              <button
                onClick={onTogglePublished}
                style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 99, cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: 600, border: 'none',
                  background: published ? 'color-mix(in srgb, var(--color-success) 15%, var(--color-surface))' : 'color-mix(in srgb, var(--color-warning) 15%, var(--color-surface))',
                  color: published ? 'var(--color-success)' : 'var(--color-warning)',
                }}
              >{published ? '● Zichtbaar' : '○ Concept'}</button>
            )}
            {onDelete && !confirmDel && (
              <button
                onClick={() => setConfirmDel(true)}
                style={{ ...ghostBtn, borderColor: 'var(--color-danger)', color: 'var(--color-danger)', fontSize: 11 }}
              >Verwijderen</button>
            )}
            {confirmDel && (
              <>
                <button onClick={() => setConfirmDel(false)} style={ghostBtn}>Nee</button>
                <button onClick={onConfirmDelete} disabled={deleting}
                  style={{ ...ghostBtn, borderColor: 'var(--color-danger)', color: 'var(--color-danger)', opacity: deleting ? 0.5 : 1 }}
                >{deleting ? 'Bezig…' : 'Ja, verwijderen'}</button>
              </>
            )}
          </div>

          {/* Seizoenskeuze */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>Seizoen:</span>
            {KNOWN_SEASONS.map(s => (
              <button key={s} onClick={() => setSeason(s)} style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 99, fontFamily: 'inherit', cursor: 'pointer',
                border: `1px solid ${season === s ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: season === s ? 'var(--color-primary)' : 'var(--color-surface)',
                color: season === s ? '#fff' : 'var(--color-text)',
              }}>{s}</button>
            ))}
          </div>

          {/* FASE-TAGS */}
          <div>
            <div style={{ ...cardLabel, marginBottom: 10 }}>FASE-TAGS (globaal)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
              {globalTags.length === 0 && (
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Nog geen tags aangemaakt.</span>
              )}
              {globalTags.map(tag => (
                <span key={tag.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, padding: '3px 6px 3px 10px', borderRadius: 20,
                  border: '1px solid var(--color-primary)',
                  color: 'var(--color-primary)',
                }}>
                  {tag.name}
                  <button onClick={() => onRequestDeleteTag(tag)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text-muted)', fontSize: 10, lineHeight: 1, padding: 0,
                  }}>✕</button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onAddTag()}
                placeholder="Nieuwe tag…"
                style={{ ...inputStyle, flex: 1, fontSize: 12 }}
              />
              <button
                onClick={onAddTag}
                disabled={addingTag || !newTagName.trim()}
                style={{ ...ghostBtn, fontSize: 12, opacity: addingTag || !newTagName.trim() ? 0.4 : 1 }}
              >+ Toevoegen</button>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
