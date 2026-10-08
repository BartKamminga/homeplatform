import { useState, useEffect, useMemo } from 'react'
import { useConfirm } from '@components/ConfirmDialog.jsx'
import { getPhotosManager, bulkPhotos, updatePhoto, getTimelineModeration, getPlayersModeration } from '../../api.js'
import { DEFAULT_FILTERS, filterPhotos, quickCounts, sortPhotos, groupPhotos } from './photoFilters.js'
import PhotoToolbar from './PhotoToolbar.jsx'
import PhotoBulkBar from './PhotoBulkBar.jsx'
import PhotoGroup from './PhotoGroup.jsx'
import PhotoDetailModal from './PhotoDetailModal.jsx'
import PhotoUploadPanel from './PhotoUploadPanel.jsx'
import useCustomPages, { SPOTLIGHT_PAGE } from '../pages/useCustomPages.js'

// Fotobeheer als werkbak (item 1213) - 1 component voor de tab Foto's en het
// fotobeheer op de wedstrijdpagina. matchRef gezet = alleen die wedstrijd
// (wedstrijdfilter vast); reportId gezet = alleen de foto's van dat bericht.
// Uploaden gebeurt in dezelfde context (meteen aan wedstrijd/bericht gekoppeld). Filters/sortering/indeling worden per browser
// onthouden, apart voor beide plekken. onChanged = na elke wijziging (bv.
// zodat de wedstrijdpreview ververst).

const storageKey = scope => `yof_photo_manager_${scope}`

function loadPrefs(scope) {
  const defaults = { filters: DEFAULT_FILTERS, sort: 'newest', grouping: scope === 'all' ? 'match' : 'status', size: 100, autoAdvance: true }
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(scope)) || '{}')
    return { ...defaults, ...saved, filters: { ...DEFAULT_FILTERS, ...(saved.filters || {}), matchRef: '' } }
  } catch {
    return defaults
  }
}

export default function PhotoManager({ matchRef = null, reportId = null, onChanged }) {
  const scope = reportId ? 'report' : matchRef ? 'match' : 'all'
  const initial = useMemo(() => loadPrefs(scope), [scope])
  const [showUpload, setShowUpload] = useState(false)
  const [photos, setPhotos] = useState(null)
  const [matchEntries, setEntries] = useState([])
  // Pagina's (In de kijker en eigen pagina's, item 1241) als extra 'wedstrijden' in de
  // keuzelijsten, zodat foto's daar ook bij naam staan en te verplaatsen zijn.
  const customPages = useCustomPages()
  const entries = useMemo(() => [
    ...[SPOTLIGHT_PAGE, ...customPages].map(p => ({ match_ref: `page:${p.id}`, title: `Pagina: ${p.label}`, date: '' })),
    ...matchEntries,
  ], [customPages, matchEntries])
  const [players, setPlayers] = useState([])
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(initial.filters)
  const [sort, setSort] = useState(initial.sort)
  const [grouping, setGrouping] = useState(initial.grouping)
  const [size, setSize] = useState(initial.size)
  const [autoAdvance, setAutoAdvance] = useState(initial.autoAdvance)
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [selected, setSelected] = useState(() => new Set())
  const [lastClicked, setLastClicked] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [confirm, confirmDialog] = useConfirm()

  function load() {
    return getPhotosManager().then(setPhotos).catch(e => setError(e.message))
  }
  useEffect(() => {
    load()
    getTimelineModeration().then(rows => setEntries([...rows].sort((a, b) => (b.date || '').localeCompare(a.date || '')))).catch(() => {})
    getPlayersModeration().then(setPlayers).catch(() => {})
  }, [])

  useEffect(() => {
    const { search, ...rest } = filters // zoekterm niet onthouden
    localStorage.setItem(storageKey(scope), JSON.stringify({ filters: rest, sort, grouping, size, autoAdvance }))
  }, [filters, sort, grouping, size, autoAdvance, scope])

  // Speelsters op rugnummer; ook de sneltoets-volgorde (1-9) in het detailvenster.
  const activePlayers = useMemo(() => players.filter(p => !p.archived_at)
    .sort((a, b) => (a.shirt_number ?? 999) - (b.shirt_number ?? 999)), [players])
  const ctx = useMemo(() => ({
    entryTitle: ref => (ref ? entries.find(e => e.match_ref === ref)?.title || ref : ''),
    entryDate: ref => entries.find(e => e.match_ref === ref)?.date || '',
    playerName: id => { const p = players.find(pl => pl.id === id); return p ? (p.nickname || p.name) : '?' },
    players: activePlayers,
  }), [entries, players, activePlayers])

  const scoped = useMemo(() => (photos || []).filter(p => (reportId ? p.report_id === reportId : !matchRef || p.match_ref === matchRef)), [photos, matchRef, reportId])
  const visible = useMemo(() => sortPhotos(filterPhotos(scoped, filters, ctx), sort, ctx), [scoped, filters, sort, ctx])
  const groups = useMemo(() => groupPhotos(visible, grouping, ctx), [visible, grouping, ctx])
  const counts = useMemo(() => quickCounts(scoped, filters, ctx), [scoped, filters, ctx])
  // Navigatievolgorde = zoals op het scherm (groepen achter elkaar, uniek).
  const ordered = useMemo(() => {
    const seen = new Set()
    return groups.flatMap(g => g.photos).filter(p => !seen.has(p.id) && seen.add(p.id))
  }, [groups])

  async function bulk(ids, action, value) {
    const res = await bulkPhotos(ids, action, value)
    await load()
    onChanged?.()
    return res
  }

  function toggleSelect(id, shift) {
    setSelected(prev => {
      const next = new Set(prev)
      if (shift && lastClicked) {
        const a = ordered.findIndex(p => p.id === lastClicked)
        const b = ordered.findIndex(p => p.id === id)
        if (a >= 0 && b >= 0) ordered.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(p => next.add(p.id))
      } else if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setLastClicked(id)
  }

  function selectGroup(list, on) {
    setSelected(prev => {
      const next = new Set(prev)
      list.forEach(p => (on ? next.add(p.id) : next.delete(p.id)))
      return next
    })
  }

  // Item 1214: verwijderen = archiveren; definitief alleen vanuit het archief (dubbele bevestiging).
  async function archiveOne(photo) {
    window.getSelection()?.removeAllRanges()
    if (!(await confirm(`${photo.media_type === 'video' ? 'Deze video' : 'Deze foto'} naar het archief? Je kunt hem altijd terugzetten.`))) return
    try { await bulk([photo.id], 'archive') } catch (e) { setError(e.message) }
  }
  async function purgeOne(photo) {
    window.getSelection()?.removeAllRanges()
    if (!(await confirm('Definitief verwijderen? Dit kan niet ongedaan gemaakt worden.'))) return
    if (!(await confirm('Weet je het zeker? Het bestand wordt echt gewist.'))) return
    try { await bulk([photo.id], 'purge') } catch (e) { setError(e.message) }
  }

  // Bulkacties werken alleen op geselecteerde foto's die nu zichtbaar zijn -
  // anders raakt bv. "publiceren" na een filterwissel ook verborgen foto's.
  const visibleIds = new Set(ordered.map(p => p.id))
  const selectedExisting = new Set([...selected].filter(id => visibleIds.has(id)))

  if (!photos) return <p style={{ fontSize: 13 }}>{error || 'Laden...'}</p>

  return (
    <div>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      {showUpload ? (
        <PhotoUploadPanel matchRef={matchRef} reportId={reportId} entries={entries} onClose={() => setShowUpload(false)}
          onUploaded={async (ids, publishNow) => {
            if (publishNow) await bulkPhotos(ids, 'publish')
            await load()
            onChanged?.()
          }} />
      ) : (
        <button onClick={() => setShowUpload(true)} className="yof-btn" style={{ width: 'auto', padding: '8px 18px', fontSize: 13, marginBottom: 10 }}>
          + Foto's uploaden{matchRef || reportId ? ' (direct gekoppeld)' : ''}
        </button>
      )}
      <PhotoToolbar filters={filters} setFilters={setFilters} sort={sort} setSort={setSort} grouping={grouping} setGrouping={setGrouping}
        size={size} setSize={setSize} counts={counts} entries={entries} players={activePlayers} lockedMatch={matchRef} />
      <PhotoBulkBar selectedCount={selectedExisting.size} visibleCount={ordered.length}
        onSelectAll={() => selectGroup(ordered, true)} onDeselect={() => setSelected(new Set())}
        onBulk={(action, value) => bulk([...selectedExisting], action, value).finally(() => ['archive', 'restore', 'purge'].includes(action) && setSelected(new Set()))}
        players={activePlayers} entries={entries} lockedMatch={matchRef} inArchive={filters.quick === 'archive'} />

      {ordered.length === 0 ? (
        <p style={{ color: '#666', fontSize: 13 }}>
          {filters.quick === 'review' && counts.all > 0
            ? 'Niets meer te beoordelen. Kies "Alles" om alle foto\'s te zien.'
            : 'Geen foto\'s met deze filters.'}
        </p>
      ) : groups.map(g => (
        <PhotoGroup key={g.key} group={g} size={size} collapsed={collapsed.has(g.key)}
          onToggleCollapse={() => setCollapsed(prev => { const n = new Set(prev); n.has(g.key) ? n.delete(g.key) : n.add(g.key); return n })}
          selected={selectedExisting} onToggleSelect={toggleSelect} onSelectGroup={selectGroup} onOpen={p => setOpenId(p.id)} />
      ))}

      {openId && (
        <PhotoDetailModal photos={ordered} openId={openId} setOpenId={setOpenId}
          autoAdvance={autoAdvance} setAutoAdvance={setAutoAdvance} tagPlayers={activePlayers}
          entries={entries} entryTitle={ctx.entryTitle} lockedMatch={matchRef}
          onAction={(photo, action, value) => bulk([photo.id], action, value).catch(e => setError(e.message))}
          onCaption={(photo, caption) => updatePhoto(photo.id, { caption }).then(load).catch(e => setError(e.message))}
          onDelete={archiveOne} onPurge={purgeOne} />
      )}
      {/* Als laatste: zelfde z-index als het detailvenster, dus later in de DOM = bovenop */}
      {confirmDialog}
    </div>
  )
}
