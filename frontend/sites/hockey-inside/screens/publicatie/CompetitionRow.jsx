import { useState, useEffect, useRef } from 'react'
import { card, deleteBtn } from '../styles.js'
import { Toggle, pill } from '../ui.jsx'
import { useQueueCmd } from '../queueShared.jsx'

// ── CompetitionRow ─────────────────────────────────────────────────────────────
// item 747 (correctie): geen poule-lijst/accordeon meer op deze rij - alleen
// de "N poule(s)"-samenvatting. De volledige standen/programma/uitslagen
// staan al in CompetitieDetailView (bereikt door op de kaart te klikken),
// dus dat is geen functieverlies. item 748 (correctie): visible- en
// scan_profile-toggle gebruiken nu exact hetzelfde ●/○-patroon + kleuren als
// de publicatie-published-toggle, i.p.v. eigen icoon/emoji-stijlen.

// item 1096a: "hoe up-to-date zijn de scans van deze competitie" - de
// OUDSTE last_scanned_at van de poules wint (die bepaalt of je de
// competitie als geheel kan vertrouwen), niet het gemiddelde.
function freshnessBadge(poules) {
  const withScan = poules.filter(p => p.last_scanned_at)
  if (withScan.length === 0) return null
  const oldest = withScan.reduce((a, b) => (a.last_scanned_at < b.last_scanned_at ? a : b))
  const hours = (Date.now() - new Date(oldest.last_scanned_at).getTime()) / 3_600_000
  const label = hours < 1 ? '<1u' : hours < 48 ? `${Math.round(hours)}u` : `${Math.round(hours / 24)}d`
  const stale = hours >= 48
  return { label, stale, missing: withScan.length < poules.length }
}

export default function CompetitionRow({ lnk, globalTags, onAssignTag, onRemoveTag, onToggleVisible, onToggleScanProfile, onRemove, onOpenDetail }) {
  const [showTagPicker, setShowTagPicker] = useState(false)
  const pickerRef   = useRef(null)
  const comp        = lnk.competition
  const poules      = lnk.poules || []
  const assigned    = lnk.fase_tags || []
  const assignedIds = new Set(assigned.map(t => t.id))
  const available   = globalTags
    .filter(t => !assignedIds.has(t.id))
    .sort((a, b) => (a.category_order ?? 0) - (b.category_order ?? 0) || a.name.localeCompare(b.name))

  // item 1105 vervolg (Bart, 07-09-2026): zelfde klikbare ⚠/❔-badges als
  // Discovery, hier over de poules van DEZE competitie-koppeling - team_id
  // komt al mee in lnk.poules (backend, hockey_publication.py), geen
  // aparte teams-fetch nodig.
  const { addSingleCmd } = useQueueCmd()
  const [groupBusy, setGroupBusy] = useState({})
  const [groupMsg,  setGroupMsg]  = useState({})
  const overdueResultPoules = poules.filter(p => p.overdue_result && p.team_id)
  const unknownStartPoules  = poules.filter(p => p.unknown_start && p.team_id)
  const freshness           = freshnessBadge(poules)

  async function handleScanGroup(e, key, group) {
    e.stopPropagation()
    if (!group.length) return
    setGroupBusy(prev => ({ ...prev, [key]: true }))
    for (const p of group) {
      await addSingleCmd('get_poule', { poule_id: p.poule_id, team_id: p.team_id, label: p.name })
    }
    setGroupBusy(prev => ({ ...prev, [key]: false }))
    setGroupMsg(prev => ({ ...prev, [key]: `✓ ${group.length}` }))
    setTimeout(() => setGroupMsg(prev => { const n = { ...prev }; delete n[key]; return n }), 3000)
  }

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
    <div onClick={onOpenDetail} style={{ ...card, marginBottom: 6, cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, padding: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            {comp?.hockey_type === 'ZA' ? '🏒 ' : '🏑 '}
            {lnk.label || [comp?.name, comp?.class_name].filter(Boolean).join(' | ') || '—'}
          </span>
          {poules.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>
              {poules.length} poule{poules.length !== 1 ? 's' : ''}
            </span>
          )}
          {freshness && (
            <span
              title={freshness.missing ? 'Niet alle poules zijn ooit gescand' : 'Oudste last_scanned_at van de poules in deze competitie'}
              style={{ fontSize: 10, color: freshness.stale ? 'var(--color-warning)' : 'var(--color-text-muted)', marginLeft: 8 }}
            >
              🕓 {freshness.label}{freshness.missing ? '*' : ''}
            </span>
          )}
        </div>
        {overdueResultPoules.length > 0 && (
          <span
            onClick={e => handleScanGroup(e, 'result', overdueResultPoules)}
            style={{ ...pill('partial'), cursor: !groupBusy.result ? 'pointer' : 'default' }}
            title={`${overdueResultPoules.length} poule(s) met late uitslag scannen`}>
            {groupBusy.result ? '…' : groupMsg.result || `⚠ ${overdueResultPoules.length}`}
          </span>
        )}
        {unknownStartPoules.length > 0 && (
          <span
            onClick={e => handleScanGroup(e, 'start', unknownStartPoules)}
            style={{ ...pill('muted'), cursor: !groupBusy.start ? 'pointer' : 'default' }}
            title={`${unknownStartPoules.length} poule(s) met onbekende starttijd scannen`}>
            {groupBusy.start ? '…' : groupMsg.start || `❔ ${unknownStartPoules.length}`}
          </span>
        )}
        <Toggle on={lnk.visible} onChange={e => { e.stopPropagation(); onToggleVisible() }}
          onLabel="● Zichtbaar" offLabel="○ Concept" offVariant="partial"
          title={lnk.visible ? 'Verbergen op Poulebord' : 'Zichtbaar maken op Poulebord'} />
        {onToggleScanProfile && (
          <Toggle on={lnk.scan_profile === 'active'} onChange={e => { e.stopPropagation(); onToggleScanProfile() }}
            onLabel="● Auto-scan" offLabel="○ Handmatig" offVariant="partial"
            title={lnk.scan_profile === 'active' ? 'Auto-scan actief — klik om uit te zetten' : 'Auto-scan uit — klik om te activeren'} />
        )}
        <button onClick={e => { e.stopPropagation(); onRemove() }} style={deleteBtn} title="Verwijder koppeling">✕</button>
      </div>

      <div onClick={e => e.stopPropagation()}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8, alignItems: 'center', position: 'relative' }}>
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
    </div>
  )
}
