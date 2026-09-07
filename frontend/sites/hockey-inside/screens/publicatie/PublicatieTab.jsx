import { useState, useEffect } from 'react'
import {
  getPublications, createPublication, updatePublication,
  reorderPublications, deletePublication, getMe, getPublicationComps,
  KNOWN_SEASONS,
} from '../../api.js'
import CompetitiesTab from './CompetitiesTab.jsx'
import { ghostBtn, primaryBtn, inputStyle } from '../styles.js'
import { Toggle, pill } from '../ui.jsx'
import { useQueueCmd } from '../queueShared.jsx'
import CreateNamedSeasonModal from '@components/CreateNamedSeasonModal.jsx'

// ── Publicatie kaart ──────────────────────────────────────────────────────────

function PublicatieCard({ t, isAdmin, onOpen, onTogglePublished, reorderable, isFirst, isLast, onMoveUp, onMoveDown }) {
  const { addSingleCmd } = useQueueCmd()
  const [groupBusy, setGroupBusy] = useState({})
  const [groupMsg,  setGroupMsg]  = useState({})

  // item 1105 vervolg (Bart, 07-09-2026: "ook voor de publicatie tab wil ik
  // die mogelijkheden"): zelfde klikbare ⚠/❔-badges als Discovery, maar dan
  // geaggregeerd over ALLE competities van deze publicatie. De lijst-view
  // heeft alleen de tellingen (overdue_result_count/unknown_start_count,
  // licht gehouden) - bij een klik pas de volledige poule-lijst (met
  // team_id) ophalen via GET /publications/{pid}/competitions.
  async function handleScanDirtyGroup(e, field, key) {
    e.stopPropagation()
    setGroupBusy(prev => ({ ...prev, [key]: true }))
    try {
      const comps = await getPublicationComps(t.id)
      const poules = comps.flatMap(c => (c.poules || []).filter(p => p[field] && p.team_id))
      for (const p of poules) {
        await addSingleCmd('get_poule', { poule_id: p.poule_id, team_id: p.team_id, label: p.name })
      }
      setGroupMsg(prev => ({ ...prev, [key]: `✓ ${poules.length}` }))
    } finally {
      setGroupBusy(prev => ({ ...prev, [key]: false }))
      setTimeout(() => setGroupMsg(prev => { const n = { ...prev }; delete n[key]; return n }), 3000)
    }
  }

  return (
    <div
      onClick={() => onOpen(t)}
      style={{
        padding: '14px 16px', background: 'var(--color-surface)',
        border: '1px solid var(--color-border)', borderRadius: 10,
        cursor: 'pointer', marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {reorderable && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
            <button type="button" title="Naar boven" disabled={isFirst}
              onClick={e => { e.stopPropagation(); onMoveUp() }}
              style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, lineHeight: 1,
                color: 'var(--color-text-muted)', cursor: isFirst ? 'default' : 'pointer', opacity: isFirst ? 0.25 : 1 }}>▲</button>
            <button type="button" title="Naar beneden" disabled={isLast}
              onClick={e => { e.stopPropagation(); onMoveDown() }}
              style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, lineHeight: 1,
                color: 'var(--color-text-muted)', cursor: isLast ? 'default' : 'pointer', opacity: isLast ? 0.25 : 1 }}>▼</button>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{t.name}</div>
          {t.season && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{t.season}</div>}
        </div>
        {/* item 1105 vervolg (Bart, 07-09-2026: "graag de uitlijning van de
            publicatie buttons aan de compbuttons, voor/naast de
            zichtbaarheid"): badges als eigen rij-elementen VOOR de toggle-
            kolom, net als bij CompetitionRow - niet mee gestapeld in die
            kolom, dat gaf een verticale stapeling i.p.v. inline uitlijning. */}
        {t.overdue_result_count > 0 && (
          <span
            onClick={e => handleScanDirtyGroup(e, 'overdue_result', 'result')}
            style={{ ...pill('partial'), cursor: !groupBusy.result ? 'pointer' : 'default', flexShrink: 0 }}
            title={`${t.overdue_result_count} poule(s) met late uitslag scannen (alle competities in deze publicatie)`}>
            {groupBusy.result ? '…' : groupMsg.result || `⚠ ${t.overdue_result_count}`}
          </span>
        )}
        {t.unknown_start_count > 0 && (
          <span
            onClick={e => handleScanDirtyGroup(e, 'unknown_start', 'start')}
            style={{ ...pill('muted'), cursor: !groupBusy.start ? 'pointer' : 'default', flexShrink: 0 }}
            title={`${t.unknown_start_count} poule(s) met onbekende starttijd scannen (alle competities in deze publicatie)`}>
            {groupBusy.start ? '…' : groupMsg.start || `❔ ${t.unknown_start_count}`}
          </span>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {isAdmin ? (
            <Toggle
              on={t.published}
              onChange={e => { e.stopPropagation(); onTogglePublished(t) }}
              onLabel="● Zichtbaar" offLabel="○ Concept" offVariant="partial"
            />
          ) : !t.published ? (
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'color-mix(in srgb, var(--color-warning) 15%, var(--color-surface))', color: 'var(--color-warning)', fontWeight: 600 }}>Concept</span>
          ) : null}
          {t.competition_count > 0 && (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{t.competition_count} comp.</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Publicatie detail ─────────────────────────────────────────────────────────

function PublicatieDetail({ tournament, isAdmin, onBack, onDeleted, onUpdated }) {
  const [t, setT] = useState(tournament)

  async function handleTogglePublished() {
    const next = !t.published
    const updated = { ...t, published: next }
    setT(updated)
    try { await updatePublication(t.id, { published: next }); onUpdated(updated) }
    catch { setT(t) }
  }

  async function handleDelete() {
    await deletePublication(t.id)
    onDeleted()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={onBack} style={{ ...ghostBtn, padding: '6px 10px' }}>← Terug</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{t.name}</div>
          {t.season && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{t.season}</div>}
        </div>
      </div>

      <CompetitiesTab
        tid={t.id}
        season={t.season}
        isAdmin={isAdmin}
        published={t.published}
        onTogglePublished={isAdmin ? handleTogglePublished : null}
        onDelete={isAdmin ? handleDelete : null}
      />
    </div>
  )
}

// ── PublicatieTab (root) ──────────────────────────────────────────────────────

export default function PublicatieTab() {
  const [tournaments, setTournaments] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState(null)
  const [isAdmin,     setIsAdmin]     = useState(false)
  const [showCreate,  setShowCreate]  = useState(false)
  const [search,      setSearch]      = useState('')

  useEffect(() => {
    getMe().then(me => setIsAdmin(me?.groups?.includes('admins') ?? false)).catch(() => {})
    load()
  }, [])

  function load() {
    setLoading(true)
    getPublications().then(setTournaments).catch(() => {}).finally(() => setLoading(false))
  }

  function handleCreated(t) {
    setShowCreate(false)
    setTournaments(prev => [t, ...prev])
    setSelected(t)
  }

  async function handleTogglePublished(t) {
    const next = !t.published
    setTournaments(prev => prev.map(x => x.id === t.id ? { ...x, published: next } : x))
    try { await updatePublication(t.id, { published: next }) }
    catch { setTournaments(prev => prev.map(x => x.id === t.id ? { ...x, published: t.published } : x)) }
  }

  function handleReorder(newList) {
    setTournaments(prev => {
      const ids = new Set(newList.map(t => t.id))
      return [...newList, ...prev.filter(t => !ids.has(t.id))]
    })
    reorderPublications(newList.map(t => t.id)).catch(() => {})
  }

  // item 883: native HTML5 drag-and-drop (draggable/onDragStart/onDrop) vuurt niet
  // op touchscreens - vervangen door knoppen die overal werken.
  function handleMove(idx, dir, list) {
    const target = idx + dir
    if (target < 0 || target >= list.length) return
    const next = [...list]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    handleReorder(next)
  }

  if (selected) {
    return (
      <PublicatieDetail
        tournament={selected}
        isAdmin={isAdmin}
        onBack={() => { setSelected(null); load() }}
        onDeleted={() => { setSelected(null); load() }}
        onUpdated={t => {
          setTournaments(prev => prev.map(x => x.id === t.id ? t : x))
          setSelected(t)
        }}
      />
    )
  }

  const q = search.trim().toLowerCase()
  const filtered = (q
    ? tournaments.filter(t => t.name.toLowerCase().includes(q))
    : tournaments
  ).filter(t => t.status === 'active')

  return (
    <div>
      {showCreate && (
        <CreateNamedSeasonModal
          title="Nieuwe publicatie"
          namePlaceholder="bijv. NK Zaalhockey 2027"
          seasons={KNOWN_SEASONS}
          onSubmit={(name, season) => createPublication({ name, season })}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="search"
          placeholder="Zoek publicatie…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        {isAdmin && (
          <button onClick={() => setShowCreate(true)} style={primaryBtn}>+ Nieuw</button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)', fontSize: 13 }}>Laden…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)', fontSize: 13 }}>
          {search ? 'Geen resultaten.' : 'Nog geen publicaties aangemaakt.'}
        </div>
      ) : (
        filtered.map((t, i) => (
          <PublicatieCard
            key={t.id}
            t={t}
            isAdmin={isAdmin}
            onOpen={setSelected}
            onTogglePublished={handleTogglePublished}
            reorderable={isAdmin && !q}
            isFirst={i === 0}
            isLast={i === filtered.length - 1}
            onMoveUp={() => handleMove(i, -1, filtered)}
            onMoveDown={() => handleMove(i, 1, filtered)}
          />
        ))
      )}
    </div>
  )
}
