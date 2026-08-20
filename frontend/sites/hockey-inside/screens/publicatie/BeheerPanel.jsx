import { KNOWN_SEASONS } from '../../api.js'
import { card, cardLabel, ghostBtn, inputStyle } from '../styles.js'
import { Toggle } from '../ui.jsx'

// ── ⚙ Beheer meta-paneel (item 635, uitgesplitst uit CompetitiesTab item 737) ──

// item 749: tags groeperen op categorie (puur presentatie - "Overig" voor tags
// zonder categorie, altijd als laatste groep, categorieën zelf gesorteerd op order).
function groupTagsByCategory(globalTags) {
  const groups = new Map()
  for (const tag of globalTags) {
    const key = tag.category_id || '__none__'
    if (!groups.has(key)) {
      groups.set(key, { id: tag.category_id, name: tag.category_name, order: tag.category_order, tags: [] })
    }
    groups.get(key).tags.push(tag)
  }
  return [...groups.values()].sort((a, b) => {
    if (a.id === null) return 1
    if (b.id === null) return -1
    return (a.order ?? 0) - (b.order ?? 0)
  })
}

export default function BeheerPanel({
  metaOpen, toggleMetaOpen,
  published, onTogglePublished,
  season, setSeason,
  globalTags, onRequestDeleteTag, onAssignTagCategory,
  newTagName, setNewTagName, addingTag, onAddTag, newTagCategoryId, setNewTagCategoryId,
  categories, onRequestDeleteCategory,
  newCatName, setNewCatName, addingCat, onAddCategory,
  onCatDragStart, onCatDragOver, onCatDrop, catOverIdx,
  onDelete, confirmDel, setConfirmDel, deleting, onConfirmDelete,
  onTagDragStart, onTagDragOver, onTagDrop, tagOverIdx,
}) {
  const tagGroups = groupTagsByCategory(globalTags)
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
              <Toggle
                on={published} onChange={onTogglePublished}
                onLabel="● Zichtbaar" offLabel="○ Concept" offVariant="partial"
                style={{ padding: '4px 10px' }}
              />
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

          {/* TAG-CATEGORIEËN (item 749: organisatorisch, geen filterlogica) */}
          <div>
            <div style={{ ...cardLabel, marginBottom: 10 }}>TAG-CATEGORIEËN</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
              {categories.length === 0 && (
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Nog geen categorieën - tags vallen dan onder "Overig".</span>
              )}
              {categories.map((cat, i) => (
                <span key={cat.id}
                  draggable
                  onDragStart={() => onCatDragStart(i)}
                  onDragOver={e => { e.preventDefault(); onCatDragOver(i) }}
                  onDrop={() => onCatDrop(i)}
                  title="Sleep om volgorde te wijzigen"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 11, padding: '3px 6px 3px 10px', borderRadius: 20,
                    border: '1px solid var(--color-text-muted)',
                    color: 'var(--color-text-muted)', cursor: 'grab',
                    opacity: catOverIdx === i ? 0.5 : 1, transition: 'opacity 0.15s',
                  }}>
                  <span style={{ opacity: 0.5, fontSize: 10 }}>⠿</span>
                  {cat.name}
                  <button onClick={() => onRequestDeleteCategory(cat)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text-muted)', fontSize: 10, lineHeight: 1, padding: 0,
                  }}>✕</button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onAddCategory()}
                placeholder="Nieuwe categorie (bv. Niveau, Leeftijd)…"
                style={{ ...inputStyle, flex: 1, fontSize: 12 }}
              />
              <button
                onClick={onAddCategory}
                disabled={addingCat || !newCatName.trim()}
                style={{ ...ghostBtn, fontSize: 12, opacity: addingCat || !newCatName.trim() ? 0.4 : 1 }}
              >+ Toevoegen</button>
            </div>
          </div>

          {/* FASE-TAGS, gegroepeerd per categorie */}
          <div>
            <div style={{ ...cardLabel, marginBottom: 10 }}>FASE-TAGS (globaal)</div>
            {globalTags.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Nog geen tags aangemaakt.</span>
            )}
            {tagGroups.map(group => (
              <div key={group.id || '__none__'} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {group.name || 'Overig'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {group.tags.map(tag => {
                    const i = globalTags.indexOf(tag)
                    return (
                      <span key={tag.id}
                        draggable={!!onTagDragStart}
                        onDragStart={() => onTagDragStart?.(i)}
                        onDragOver={e => { e.preventDefault(); onTagDragOver?.(i) }}
                        onDrop={() => onTagDrop?.(i)}
                        title={onTagDragStart ? 'Sleep om volgorde te wijzigen' : undefined}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 11, padding: '3px 6px 3px 10px', borderRadius: 20,
                          border: '1px solid var(--color-primary)',
                          color: 'var(--color-primary)',
                          cursor: onTagDragStart ? 'grab' : 'default',
                          opacity: tagOverIdx === i ? 0.5 : 1, transition: 'opacity 0.15s',
                        }}>
                        {onTagDragStart && <span style={{ opacity: 0.5, fontSize: 10 }}>⠿</span>}
                        {tag.name}
                        <select
                          value={tag.category_id || ''}
                          onChange={e => onAssignTagCategory(tag.id, e.target.value || null)}
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: 9, border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          <option value="">Overig</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button onClick={() => onRequestDeleteTag(tag)} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--color-text-muted)', fontSize: 10, lineHeight: 1, padding: 0,
                        }}>✕</button>
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onAddTag()}
                placeholder="Nieuwe tag…"
                style={{ ...inputStyle, flex: 1, fontSize: 12 }}
              />
              <select
                value={newTagCategoryId}
                onChange={e => setNewTagCategoryId(e.target.value)}
                style={{ ...inputStyle, fontSize: 12, width: 120 }}
              >
                <option value="">Overig</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
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
