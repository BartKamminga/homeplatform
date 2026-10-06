import { useState } from 'react'
import { QUICK_FILTERS, SORTS, GROUPINGS, PHOTO_TYPES, DEFAULT_FILTERS } from './photoFilters.js'

// Werkbalk van de PhotoManager: snelfilters met aantallen, zoeken, filters,
// sorteren, indeling en tegelgrootte. lockedMatch = op de wedstrijdpagina
// (wedstrijdfilter vast, dus niet tonen).

const select = { fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid #ddd', background: 'white', maxWidth: 190 }

function Select({ value, onChange, children, title }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...select, fontWeight: value ? 700 : 400 }} title={title}>
      {children}
    </select>
  )
}

export default function PhotoToolbar({ filters, setFilters, sort, setSort, grouping, setGrouping, size, setSize, counts, entries, players, lockedMatch }) {
  const [showMore, setShowMore] = useState(
    () => ['highlight', 'favorite', 'attached', 'source', 'period'].some(k => filters[k]),
  )
  const set = key => value => setFilters(f => ({ ...f, [key]: value }))
  const activeCount = Object.keys(DEFAULT_FILTERS).filter(k => k !== 'quick' && filters[k]).length

  return (
    <div style={{ display: 'grid', gap: 8, marginBottom: 12, padding: 10, background: '#f4f6fb', borderRadius: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {QUICK_FILTERS.map(q => {
          const active = filters.quick === q.key
          return (
            <button key={q.key} onClick={() => set('quick')(q.key)} style={{
              borderRadius: 999, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 700,
              border: active ? '2px solid #12203c' : '1px solid #ccd3e0',
              background: active ? '#12203c' : 'white', color: active ? 'white' : '#12203c',
            }}>
              {q.label} ({counts[q.key] ?? 0})
            </button>
          )
        })}
        <input type="search" placeholder="Zoek wedstrijd, speelster, notitie..." value={filters.search}
          onChange={e => set('search')(e.target.value)}
          style={{ ...select, flex: '1 1 180px', maxWidth: 'none', padding: '5px 8px' }} />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select value={filters.status} onChange={set('status')} title="Status">
          <option value="">Status: alle</option>
          <option value="concept">Concept</option>
          <option value="published">Live</option>
        </Select>
        {!lockedMatch && (
          <Select value={filters.matchRef} onChange={set('matchRef')} title="Wedstrijd">
            <option value="">Wedstrijd: alle</option>
            <option value="none">Zonder wedstrijd (algemene berichten)</option>
            {entries.map(e => <option key={e.match_ref} value={e.match_ref}>{(e.date || '').slice(0, 10)} · {e.title}</option>)}
          </Select>
        )}
        <Select value={filters.playerId} onChange={set('playerId')} title="Speelster">
          <option value="">Speelster: alle</option>
          <option value="none">Niemand getagd</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}
        </Select>
        <Select value={filters.type} onChange={set('type')} title="Type">
          <option value="">Type: alle</option>
          {PHOTO_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </Select>
        <Select value={filters.media} onChange={set('media')} title="Foto of video">
          <option value="">Foto's en video's</option>
          <option value="photo">Alleen foto's</option>
          <option value="video">Alleen video's</option>
        </Select>
        <button onClick={() => setShowMore(s => !s)} className="yof-btn-secondary" style={{ fontSize: 12 }}>
          {showMore ? '▾' : '▸'} Meer
        </button>
        {activeCount > 0 && (
          <button onClick={() => setFilters(f => ({ ...DEFAULT_FILTERS, quick: f.quick }))} className="yof-btn-secondary" style={{ fontSize: 12 }}>
            Wis filters ({activeCount})
          </button>
        )}
      </div>

      {showMore && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Select value={filters.highlight} onChange={set('highlight')} title="Wedstrijd-highlight">
            <option value="">Highlight: alle</option>
            <option value="yes">Alleen highlights ⭐</option>
            <option value="no">Geen highlight</option>
          </Select>
          <Select value={filters.favorite} onChange={set('favorite')} title="Favoriet van een speelster">
            <option value="">Favoriet: alle</option>
            <option value="yes">Favoriet van een speelster ♥</option>
          </Select>
          <Select value={filters.attached} onChange={set('attached')} title="Bij een verslag of los">
            <option value="">Verslag: alle</option>
            <option value="report">Bij een verslag/bericht</option>
            <option value="general">Bij een algemeen bericht</option>
            <option value="loose">Los (fotoblok)</option>
          </Select>
          <Select value={filters.source} onChange={set('source')} title="Wie heeft geupload">
            <option value="">Bron: alle</option>
            <option value="sitelink">Upload via de site</option>
            <option value="invullink">Via een invullink</option>
            <option value="beheer">Beheerder</option>
          </Select>
          <Select value={filters.period} onChange={set('period')} title="Geupload in de laatste">
            <option value="">Periode: alles</option>
            <option value="1">Afgelopen 24 uur</option>
            <option value="7">Afgelopen week</option>
            <option value="30">Afgelopen maand</option>
          </Select>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 12, color: '#555' }}>
        <label>Sorteren <Select value={sort} onChange={setSort}>{SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</Select></label>
        <label>Indeling <Select value={grouping} onChange={setGrouping}>{GROUPINGS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}</Select></label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Tegels
          <input type="range" min={70} max={220} step={10} value={size} onChange={e => setSize(Number(e.target.value))} />
        </label>
      </div>
    </div>
  )
}
