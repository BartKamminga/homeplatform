import { useState, useEffect, useRef } from 'react'
import {
  getTournamentComps, addTournamentComp, updateTournamentComp, removeTournamentComp,
  getDiscoveryComps, syncCompetition,
  getFaseTags, addFaseTag, removeFaseTag,
  assignCompFaseTag, removeCompFaseTag,
  getCompetitionMatches, getHockeyPouleStandings,
  KNOWN_SEASONS,
} from '../api.js'
import {
  card, cardLabel, ghostBtn,
  muted, successBanner, errorBanner, deleteBtn, inputStyle,
} from './styles.js'

function normalizeSeason(s) {
  if (!s) return '2026-2027'
  const clean = s.trim().replace(/\s*-\s*/, '-')
  return KNOWN_SEASONS.includes(clean) ? clean : '2026-2027'
}

function InlineConfirm({ msg, onConfirm, onCancel }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid #dc262633',
      borderRadius: 8, padding: '10px 14px', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    }}>
      <span style={{ flex: 1, fontSize: 12, minWidth: 120 }}>{msg}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onCancel} style={{
          padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
          border: '1px solid var(--color-border)', background: 'var(--color-bg)',
          color: 'var(--color-text)', fontFamily: 'inherit',
        }}>Nee</button>
        <button onClick={onConfirm} style={{
          padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
          border: 'none', background: '#dc2626', color: '#fff',
          fontFamily: 'inherit', fontWeight: 600,
        }}>Ja</button>
      </div>
    </div>
  )
}

export default function CompetitiesTab({ tid, season: seasonProp = '2026-2027' }) {
  const [links,       setLinks]       = useState([])
  const [globalTags,  setGlobalTags]  = useState([])
  const [allComps,    setAllComps]    = useState([])
  const [loading,     setLoading]     = useState(false)
  const [msg,         setMsg]         = useState('')
  const [error,       setError]       = useState('')
  const [showPicker,  setShowPicker]  = useState(false)
  const [filterQ,     setFilterQ]     = useState('')
  const [adding,      setAdding]      = useState(false)
  const [newTagName,  setNewTagName]  = useState('')
  const [addingTag,   setAddingTag]   = useState(false)
  const [season,      setSeason]      = useState(() => normalizeSeason(seasonProp))
  const [selectedComps, setSelectedComps] = useState(new Set())
  const [confirmTag,  setConfirmTag]  = useState(null)
  const [confirmLink, setConfirmLink] = useState(null)

  useEffect(() => { loadGlobalTags() }, [])
  useEffect(() => { if (tid) { loadLinks() } }, [tid])
  useEffect(() => { if (tid) { loadComps() } }, [tid, season])

  async function loadLinks() {
    setLoading(true)
    try { setLinks(await getTournamentComps(tid)) }
    catch (e) { flash(e.message, true) }
    finally { setLoading(false) }
  }

  async function loadGlobalTags() {
    try { setGlobalTags(await getFaseTags()) }
    catch { /* stil */ }
  }

  async function loadComps() {
    try {
      const r = await getDiscoveryComps(season)
      setAllComps(r.competitions || [])
    } catch { /* stil */ }
  }

  function flash(text, isErr = false) {
    if (isErr) setError(text); else setMsg(text)
    setTimeout(() => { setMsg(''); setError('') }, 3500)
  }

  // ── Globale tag-pool beheer ──────────────────────────────────────────────────

  async function handleAddTag() {
    const name = newTagName.trim()
    if (!name) return
    setAddingTag(true)
    try {
      const t = await addFaseTag({ name })
      setGlobalTags(prev => prev.some(x => x.id === t.id) ? prev : [...prev, t])
      setNewTagName('')
    } catch (e) { flash(e.message, true) }
    finally { setAddingTag(false) }
  }

  async function doRemoveTag(tag) {
    setConfirmTag(null)
    try {
      await removeFaseTag(tag.id)
      setGlobalTags(prev => prev.filter(x => x.id !== tag.id))
      setLinks(prev => prev.map(l => ({
        ...l, fase_tags: (l.fase_tags || []).filter(t => t.id !== tag.id),
      })))
    } catch (e) { flash(e.message, true) }
  }

  // ── Tags per competitie ──────────────────────────────────────────────────────

  async function handleAssignTag(lnk, tagId) {
    const tag = globalTags.find(t => t.id === tagId)
    if (!tag) return
    setLinks(prev => prev.map(l => l.id === lnk.id
      ? { ...l, fase_tags: [...(l.fase_tags || []), { id: tag.id, name: tag.name }] }
      : l
    ))
    try {
      await assignCompFaseTag(tid, lnk.id, tagId)
    } catch (e) {
      setLinks(prev => prev.map(l => l.id === lnk.id
        ? { ...l, fase_tags: (l.fase_tags || []).filter(t => t.id !== tagId) }
        : l
      ))
      flash(e.message, true)
    }
  }

  async function handleRemoveCompTag(lnk, tagId) {
    setLinks(prev => prev.map(l => l.id === lnk.id
      ? { ...l, fase_tags: (l.fase_tags || []).filter(t => t.id !== tagId) }
      : l
    ))
    try {
      await removeCompFaseTag(tid, lnk.id, tagId)
    } catch (e) {
      await loadLinks()
      flash(e.message, true)
    }
  }

  // ── Competitie koppelen ──────────────────────────────────────────────────────

  async function handleAdd(comp) {
    setAdding(true)
    try {
      await addTournamentComp(tid, { competition_id: comp.id, order: links.length })
      syncCompetition(comp.id).catch(() => {})
      flash(`${comp.name} gekoppeld`)
      setShowPicker(false)
      setFilterQ('')
      setSelectedComps(new Set())
      await loadLinks()
    } catch (e) { flash(e.message, true) }
    finally { setAdding(false) }
  }

  async function handleBulkAdd() {
    if (!selectedComps.size) return
    setAdding(true)
    const comps = allComps.filter(c => selectedComps.has(c.id))
    try {
      for (let i = 0; i < comps.length; i++) {
        await addTournamentComp(tid, { competition_id: comps[i].id, order: links.length + i })
        syncCompetition(comps[i].id).catch(() => {})
      }
      flash(`${comps.length} competities gekoppeld`)
      setShowPicker(false)
      setFilterQ('')
      setSelectedComps(new Set())
      await loadLinks()
    } catch (e) { flash(e.message, true) }
    finally { setAdding(false) }
  }

  async function handleToggleVisible(lnk) {
    const next = !lnk.visible
    setLinks(prev => prev.map(l => l.id === lnk.id ? { ...l, visible: next } : l))
    try {
      await updateTournamentComp(tid, lnk.id, { visible: next })
    } catch (e) {
      setLinks(prev => prev.map(l => l.id === lnk.id ? { ...l, visible: !next } : l))
      flash(e.message, true)
    }
  }

  async function doRemoveLink(lnk) {
    setConfirmLink(null)
    try {
      await removeTournamentComp(tid, lnk.id)
      flash('Koppeling verwijderd')
      await loadLinks()
    } catch (e) { flash(e.message, true) }
  }

  if (!tid) return <p style={muted}>Laden…</p>
  if (loading) return <p style={muted}>Laden…</p>

  const linkedIds = new Set(links.map(l => l.competition_id))
  const q = filterQ.trim().toLowerCase()
  const pickerComps = allComps
    .filter(c => !linkedIds.has(c.id))
    .filter(c => !q || c.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {msg   && <div style={successBanner}>{msg}</div>}
      {error && <div style={errorBanner}>{error}</div>}

      {confirmTag && (
        <InlineConfirm
          msg={`Tag "${confirmTag.name}" verwijderen? Wordt ook bij alle koppelingen verwijderd.`}
          onConfirm={() => doRemoveTag(confirmTag)}
          onCancel={() => setConfirmTag(null)}
        />
      )}
      {confirmLink && (
        <InlineConfirm
          msg={`Koppeling met "${confirmLink.competition?.name}" verwijderen?`}
          onConfirm={() => doRemoveLink(confirmLink)}
          onCancel={() => setConfirmLink(null)}
        />
      )}

      {/* ── Globale fase-tag pool ────────────────────────────────── */}
      <div style={card}>
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
              <button onClick={() => setConfirmTag(tag)} style={{
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
            onKeyDown={e => e.key === 'Enter' && handleAddTag()}
            placeholder="Nieuwe tag…"
            style={{ ...inputStyle, flex: 1, fontSize: 12 }}
          />
          <button
            onClick={handleAddTag}
            disabled={addingTag || !newTagName.trim()}
            style={{ ...ghostBtn, fontSize: 12, opacity: addingTag || !newTagName.trim() ? 0.4 : 1 }}
          >+ Toevoegen</button>
        </div>
      </div>

      {/* ── Seizoen filter ───────────────────────────────────────── */}
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

      {/* ── Gekoppelde competities ───────────────────────────────── */}
      {links.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, padding: 24 }}>
          Nog geen competities gekoppeld.
        </div>
      ) : links.map(lnk => (
        <CompetitionRow
          key={lnk.id}
          lnk={lnk}
          globalTags={globalTags}
          onAssignTag={tagId => handleAssignTag(lnk, tagId)}
          onRemoveTag={tagId => handleRemoveCompTag(lnk, tagId)}
          onToggleVisible={() => handleToggleVisible(lnk)}
          onRemove={() => setConfirmLink(lnk)}
        />
      ))}

      {/* ── Competitie koppelen ──────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: showPicker ? 12 : 0 }}>
          <div style={cardLabel}>COMPETITIE KOPPELEN</div>
          {showPicker && selectedComps.size > 0 && (
            <button
              onClick={handleBulkAdd}
              disabled={adding}
              style={{ ...ghostBtn, fontSize: 12, color: 'var(--color-primary)', borderColor: 'var(--color-primary)', opacity: adding ? 0.5 : 1 }}
            >
              {adding ? 'Bezig…' : `+ Koppel ${selectedComps.size} geselecteerde`}
            </button>
          )}
          <button
            onClick={() => { setShowPicker(p => !p); setFilterQ(''); setSelectedComps(new Set()) }}
            style={{ ...ghostBtn, fontSize: 12, marginLeft: 'auto' }}
          >
            {showPicker ? 'Sluiten' : '+ Koppelen'}
          </button>
        </div>
        {showPicker && (
          <>
            <input
              value={filterQ}
              onChange={e => setFilterQ(e.target.value)}
              placeholder="Filter op naam…"
              autoFocus
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 10 }}
            />
            {pickerComps.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', padding: '8px 0' }}>
                {allComps.length === 0 ? 'Geen discovery-competities gevonden.' : 'Alle competities al gekoppeld.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
                {pickerComps.map(comp => {
                  const checked = selectedComps.has(comp.id)
                  return (
                    <div key={comp.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', borderRadius: 8,
                      border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: checked ? 'var(--color-primary)11' : 'var(--color-surface)',
                      cursor: adding ? 'default' : 'pointer',
                    }} onClick={() => {
                      if (adding) return
                      setSelectedComps(prev => {
                        const n = new Set(prev)
                        if (n.has(comp.id)) n.delete(comp.id); else n.add(comp.id)
                        return n
                      })
                    }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {}}
                        onClick={e => e.stopPropagation()}
                        style={{ flexShrink: 0, width: 'auto', accentColor: 'var(--color-primary)' }}
                      />
                      <span style={{ fontSize: 11, opacity: 0.6, flexShrink: 0 }}>
                        {comp.hockey_type === 'ZA' ? '🏒' : '🏑'}
                      </span>
                      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontSize: 13, color: 'var(--color-text)' }}>{comp.name}</span>
                        {comp.class_name && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{comp.class_name}</span>}
                      </span>
                      {!checked && (
                        <button onClick={e => { e.stopPropagation(); if (!adding) handleAdd(comp) }} disabled={adding}
                          style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                          + Direct
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── PouleDetail (stand + wedstrijden) ─────────────────────────────────────────

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
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.played ?? (r.won+r.drawn+r.lost)}</td>
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
          {data.finished.length > 10 && (
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>+{data.finished.length - 10} eerder</div>
          )}
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
          {data.scheduled.length > 10 && (
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>+{data.scheduled.length - 10} meer</div>
          )}
        </div>
      )}

      {!data?.standings?.length && !data?.finished?.length && !data?.scheduled?.length && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Geen data beschikbaar.</div>
      )}
    </div>
  )
}

// ── CompetitionRow ─────────────────────────────────────────────────────────────

function CompetitionRow({ lnk, globalTags, onAssignTag, onRemoveTag, onToggleVisible, onRemove }) {
  const [open,         setOpen]         = useState(false)
  const [openPoule,    setOpenPoule]    = useState(null)
  const [showTagPicker, setShowTagPicker] = useState(false)
  const pickerRef = useRef(null)
  const comp      = lnk.competition
  const poules    = lnk.poules || []
  const assigned  = lnk.fase_tags || []
  const assignedIds = new Set(assigned.map(t => t.id))
  const available = globalTags.filter(t => !assignedIds.has(t.id))

  const suggestedTags = globalTags.filter(gt =>
    !assignedIds.has(gt.id) &&
    [comp?.class_name, comp?.district].some(s =>
      s && gt.name.toLowerCase() === s.toLowerCase()
    )
  )

  useEffect(() => {
    if (!showTagPicker) return
    function onClickOut(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowTagPicker(false)
    }
    document.addEventListener('mousedown', onClickOut)
    return () => document.removeEventListener('mousedown', onClickOut)
  }, [showTagPicker])

  function togglePoule(pid) {
    setOpenPoule(prev => prev === pid ? null : pid)
  }

  return (
    <div style={{ ...card, marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {/* naam + poules toggle */}
        <button onClick={() => { setOpen(o => !o); setOpenPoule(null) }}
          style={{ flex: 1, background: 'none', border: 'none', padding: 0,
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
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
        <button
          onClick={onToggleVisible}
          title={lnk.visible ? 'Verbergen op Poulebord' : 'Zichtbaar maken op Poulebord'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
            opacity: lnk.visible ? 1 : 0.35, padding: '0 2px',
          }}
        >{lnk.visible ? '👁' : '🚫'}</button>
        <button onClick={onRemove} style={deleteBtn} title="Verwijder koppeling">✕</button>
      </div>

      {/* tag chips + toevoegen */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8, alignItems: 'center', position: 'relative' }}>
        {assigned.map(tag => (
          <span key={tag.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 11, padding: '2px 6px 2px 8px', borderRadius: 20,
            background: 'var(--color-primary)', color: '#fff',
          }}>
            {tag.name}
            <button onClick={() => onRemoveTag(tag.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.8)', fontSize: 10, lineHeight: 1, padding: 0,
            }}>✕</button>
          </span>
        ))}

        {available.length > 0 && (
          <div ref={pickerRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowTagPicker(p => !p)}
              style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 20,
                border: '1px dashed var(--color-primary)',
                color: 'var(--color-primary)', background: 'none',
                cursor: 'pointer',
              }}
            >+ tag</button>
            {showTagPicker && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.15)',
                padding: '6px 0', minWidth: 140,
              }}>
                {available.map(tag => (
                  <button key={tag.id}
                    onClick={() => { onAssignTag(tag.id); setShowTagPicker(false) }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '6px 14px', fontSize: 12,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--color-text)',
                    }}
                  >{tag.name}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {suggestedTags.map(tag => (
          <button key={`sug-${tag.id}`} onClick={() => { onAssignTag(tag.id); setShowTagPicker(false) }} style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 11, padding: '2px 8px', borderRadius: 20,
            border: '1px dashed var(--color-text-muted)',
            color: 'var(--color-text-muted)', background: 'none', cursor: 'pointer',
          }} title={`Suggestie op basis van ${comp?.class_name === tag.name ? 'klasse' : 'district'}`}>
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
              <button
                onClick={() => togglePoule(p.id)}
                style={{
                  width: '100%', textAlign: 'left', background: openPoule === p.id ? 'var(--color-primary)11' : 'var(--color-bg)',
                  border: `1px solid ${openPoule === p.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                  fontSize: 12, color: 'var(--color-text)', fontFamily: 'inherit',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
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
