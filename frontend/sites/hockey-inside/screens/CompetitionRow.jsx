import { useState, useEffect, useRef } from 'react'
import { getHockeyPouleStandings, getCompetitionMatches } from '../api.js'
import { card, deleteBtn } from './styles.js'

// ── PouleDetail ────────────────────────────────────────────────────────────────

function PouleDetail({ poule }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getHockeyPouleStandings(poule.id).catch(() => null),
      getCompetitionMatches(poule.competition_id).catch(() => null),
    ]).then(([standings, matchData]) => {
      const pouleMeta = matchData?.poules?.find(p => p.id === poule.id)
      setData({ standings: standings?.standings || [], finished: pouleMeta?.finished || [], scheduled: pouleMeta?.scheduled || [] })
    }).finally(() => setLoading(false))
  }, [poule.id])

  if (loading) return <div style={{ fontSize: 11, color: 'var(--color-text-muted)', padding: '6px 0' }}>Laden…</div>

  return (
    <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
      {data?.standings?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '.05em', marginBottom: 4 }}>STAND</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ color: 'var(--color-text-muted)', textAlign: 'right' }}>
                <th style={{ textAlign: 'left', paddingRight: 8, fontWeight: 400 }}>Team</th>
                <th style={{ width: 24 }}>G</th><th style={{ width: 24 }}>W</th>
                <th style={{ width: 24 }}>G</th><th style={{ width: 24 }}>V</th>
                <th style={{ width: 36 }}>Doel</th><th style={{ width: 28, fontWeight: 700 }}>Pnt</th>
              </tr>
            </thead>
            <tbody>
              {data.standings.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                  <td style={{ padding: '2px 8px 2px 0', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.team_name}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.played ?? (r.won + r.drawn + r.lost)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.won}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.drawn}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.lost}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.gf}-{r.ga}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{r.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data?.finished?.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '.05em', marginBottom: 4 }}>GESPEELD</div>
          {data.finished.slice(-10).map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11, padding: '2px 0', borderTop: '1px solid var(--color-border)' }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.home}</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{m.home_score ?? '?'}–{m.away_score ?? '?'}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{m.away}</span>
            </div>
          ))}
          {data.finished.length > 10 && <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>+{data.finished.length - 10} eerder</div>}
        </div>
      )}
      {data?.scheduled?.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '.05em', marginBottom: 4 }}>GEPLAND</div>
          {data.scheduled.slice(0, 10).map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11, padding: '2px 0', borderTop: '1px solid var(--color-border)' }}>
              {m.date && <span style={{ color: 'var(--color-text-muted)', flexShrink: 0, fontSize: 10 }}>{m.date.slice(0, 10)}</span>}
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.home}</span>
              <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>vs</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{m.away}</span>
            </div>
          ))}
          {data.scheduled.length > 10 && <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>+{data.scheduled.length - 10} meer</div>}
        </div>
      )}
      {!data?.standings?.length && !data?.finished?.length && !data?.scheduled?.length && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Geen data beschikbaar.</div>
      )}
    </div>
  )
}

// ── CompetitionRow ─────────────────────────────────────────────────────────────

export default function CompetitionRow({ lnk, globalTags, onAssignTag, onRemoveTag, onToggleVisible, onToggleScanProfile, onRemove, onOpenDetail }) {
  const [open,          setOpen]          = useState(false)
  const [openPoule,     setOpenPoule]     = useState(null)
  const [showTagPicker, setShowTagPicker] = useState(false)
  const pickerRef   = useRef(null)
  const comp        = lnk.competition
  const poules      = lnk.poules || []
  const assigned    = lnk.fase_tags || []
  const assignedIds = new Set(assigned.map(t => t.id))
  const available   = globalTags.filter(t => !assignedIds.has(t.id))

  const suggestedTags = globalTags.filter(gt =>
    !assignedIds.has(gt.id) &&
    [comp?.class_name, comp?.district].some(s => s && gt.name.toLowerCase() === s.toLowerCase())
  )

  useEffect(() => {
    if (!showTagPicker) return
    function onClickOut(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowTagPicker(false)
    }
    document.addEventListener('mousedown', onClickOut)
    return () => document.removeEventListener('mousedown', onClickOut)
  }, [showTagPicker])

  return (
    <div style={{ ...card, marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <button onClick={() => { setOpen(o => !o); setOpenPoule(null) }}
          style={{ flex: 1, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            {comp?.hockey_type === 'ZA' ? '🏒 ' : '🏑 '}
            {lnk.label || [comp?.name, comp?.class_name].filter(Boolean).join(' | ') || '—'}
          </span>
          {poules.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>
              {poules.length} poule{poules.length !== 1 ? 's' : ''} {open ? '▲' : '▼'}
            </span>
          )}
        </button>
        <button onClick={onOpenDetail} title="Open detail"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-primary)', padding: '0 2px', fontFamily: 'inherit' }}>→</button>
        <button onClick={onToggleVisible} title={lnk.visible ? 'Verbergen op Poulebord' : 'Zichtbaar maken op Poulebord'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: lnk.visible ? 1 : 0.35, padding: '0 2px' }}>
          {lnk.visible ? '👁' : '🚫'}
        </button>
        {onToggleScanProfile && (
          <button onClick={onToggleScanProfile}
            title={lnk.scan_profile === 'active' ? 'Auto-scan actief — klik om uit te zetten' : 'Auto-scan uit — klik om te activeren'}
            style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 99, cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 600, border: 'none',
              background: lnk.scan_profile === 'active' ? '#16a34a22' : 'var(--color-bg)',
              color: lnk.scan_profile === 'active' ? '#16a34a' : 'var(--color-text-muted)',
            }}>
            {lnk.scan_profile === 'active' ? '🔄 Auto-scan' : '⏸ Handmatig'}
          </button>
        )}
        <button onClick={onRemove} style={deleteBtn} title="Verwijder koppeling">✕</button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8, alignItems: 'center', position: 'relative' }}>
        {assigned.map(tag => (
          <span key={tag.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '2px 6px 2px 8px', borderRadius: 20, background: 'var(--color-primary)', color: '#fff' }}>
            {tag.name}
            <button onClick={() => onRemoveTag(tag.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: 10, lineHeight: 1, padding: 0 }}>✕</button>
          </span>
        ))}
        {available.length > 0 && (
          <div ref={pickerRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowTagPicker(p => !p)}
              style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, border: '1px dashed var(--color-primary)', color: 'var(--color-primary)', background: 'none', cursor: 'pointer' }}>
              + tag
            </button>
            {showTagPicker && (
              <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.15)', padding: '6px 0', minWidth: 140 }}>
                {available.map(tag => (
                  <button key={tag.id} onClick={() => { onAssignTag(tag.id); setShowTagPicker(false) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 14px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {suggestedTags.map(tag => (
          <button key={`sug-${tag.id}`} onClick={() => { onAssignTag(tag.id); setShowTagPicker(false) }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '2px 8px', borderRadius: 20, border: '1px dashed var(--color-text-muted)', color: 'var(--color-text-muted)', background: 'none', cursor: 'pointer' }}
            title={`Suggestie op basis van ${comp?.class_name === tag.name ? 'klasse' : 'district'}`}>
            + {tag.name}
          </button>
        ))}
        {assigned.length === 0 && available.length === 0 && suggestedTags.length === 0 && (
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>geen tags</span>
        )}
      </div>

      {open && poules.length > 0 && (
        <div style={{ paddingTop: 10 }}>
          {poules.map(p => (
            <div key={p.id} style={{ marginBottom: 4 }}>
              <button onClick={() => setOpenPoule(prev => prev === p.id ? null : p.id)}
                style={{ width: '100%', textAlign: 'left', background: openPoule === p.id ? 'var(--color-primary)11' : 'var(--color-bg)', border: `1px solid ${openPoule === p.id ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--color-text)', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{p.name}</span>
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                  {p.matches_played ?? 0}/{p.matches_total ?? 0} gespeeld {openPoule === p.id ? '▲' : '▼'}
                </span>
              </button>
              {openPoule === p.id && (
                <div style={{ padding: '6px 10px 4px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
                  <PouleDetail poule={{ ...p, competition_id: comp?.id }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
