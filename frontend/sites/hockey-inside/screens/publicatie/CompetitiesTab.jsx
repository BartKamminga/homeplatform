import { useState } from 'react'
import { KNOWN_SEASONS } from '../../api.js'
import { card, muted, successBanner, errorBanner } from '../styles.js'
import { useCollapse, ConfirmDialog } from '../ui.jsx'
import CompetitieDetailView from './CompetitieDetailView.jsx'
import CompetitionRow from './CompetitionRow.jsx'
import BeheerPanel from './BeheerPanel.jsx'
import CompetitiePicker from './CompetitiePicker.jsx'
import { useCategoryManagement } from './hooks/useCategoryManagement.jsx'
import { useTagManagement } from './hooks/useTagManagement.jsx'
import { useCompetitionLinks } from './hooks/useCompetitionLinks.jsx'

function normalizeSeason(s) {
  if (!s) return '2026-2027'
  const clean = s.trim().replace(/\s*-\s*/, '-')
  return KNOWN_SEASONS.includes(clean) ? clean : '2026-2027'
}

export default function CompetitiesTab({
  tid,
  season: seasonProp = '2026-2027',
  isAdmin       = false,
  published     = false,
  onTogglePublished = null,
  onDelete      = null,
}) {
  const [season, setSeason] = useState(() => normalizeSeason(seasonProp))
  const [msg,   setMsg]   = useState('')
  const [error, setError] = useState('')
  const [metaOpen, toggleMetaOpen] = useCollapse(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  function flash(text, isErr = false) {
    if (isErr) setError(text); else setMsg(text)
    setTimeout(() => { setMsg(''); setError('') }, 3500)
  }

  // Volgorde is bewust: categoryMgmt is volledig onafhankelijk, tagMgmt heeft
  // categoryMgmt.categories nodig (denormaliseren bij toewijzing), linkMgmt
  // heeft tagMgmt.globalTags nodig (naam-lookup bij toewijzing aan een
  // koppeling). Opruim-cascades (tag/categorie verwijderen) lopen als kleine
  // orchestratie-callbacks hieronder, niet als directe hook-naar-hook-
  // afhankelijkheid (RFTR-B6, item 989, fase 6.4).
  const categoryMgmt = useCategoryManagement(flash)
  const tagMgmt  = useTagManagement(flash, categoryMgmt.categories)
  const linkMgmt = useCompetitionLinks(tid, season, tagMgmt.globalTags, flash)

  async function handleConfirmDeleteTag(tag) {
    const ok = await tagMgmt.doRemoveTag(tag)
    if (ok) linkMgmt.stripTagFromLinks(tag.id)
  }

  async function handleConfirmDeleteCategory(cat) {
    const ok = await categoryMgmt.doRemoveCategory(cat)
    if (ok) tagMgmt.declassifyCategory(cat.id)
  }

  async function handleDelete() {
    setDeleting(true)
    try { await onDelete?.() }
    catch { flash('Verwijderen mislukt', true) }
    finally { setDeleting(false); setConfirmDel(false) }
  }

  if (!tid) return <p style={muted}>Laden…</p>
  if (linkMgmt.loading) return <p style={muted}>Laden…</p>

  if (linkMgmt.selectedLnk) {
    return <CompetitieDetailView lnk={linkMgmt.selectedLnk} onBack={() => linkMgmt.setSelectedLnk(null)} />
  }

  const linkedIds = new Set(linkMgmt.links.map(l => l.competition_id))
  const q = linkMgmt.filterQ.trim().toLowerCase()
  const pickerComps = linkMgmt.allComps
    .filter(c => !linkedIds.has(c.id))
    .filter(c => !q || c.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {msg   && <div style={successBanner}>{msg}</div>}
      {error && <div style={errorBanner}>{error}</div>}

      <ConfirmDialog open={!!tagMgmt.confirmTag} onConfirm={() => handleConfirmDeleteTag(tagMgmt.confirmTag)} onCancel={() => tagMgmt.setConfirmTag(null)}>
        Tag "{tagMgmt.confirmTag?.name}" verwijderen? Wordt ook bij alle koppelingen verwijderd.
      </ConfirmDialog>
      <ConfirmDialog open={!!linkMgmt.confirmLink} onConfirm={() => linkMgmt.doRemoveLink(linkMgmt.confirmLink)} onCancel={() => linkMgmt.setConfirmLink(null)}>
        Koppeling met "{linkMgmt.confirmLink?.competition?.name}" verwijderen?
      </ConfirmDialog>
      <ConfirmDialog open={!!categoryMgmt.confirmCat} onConfirm={() => handleConfirmDeleteCategory(categoryMgmt.confirmCat)} onCancel={() => categoryMgmt.setConfirmCat(null)}>
        Categorie "{categoryMgmt.confirmCat?.name}" verwijderen? Tags in deze categorie vallen terug naar "Overig".
      </ConfirmDialog>
      <ConfirmDialog open={confirmDel} busy={deleting} onConfirm={handleDelete} onCancel={() => setConfirmDel(false)}>
        Deze publicatie definitief verwijderen? Dit kan niet ongedaan gemaakt worden.
      </ConfirmDialog>

      {isAdmin && (
        <BeheerPanel
          metaOpen={metaOpen} toggleMetaOpen={toggleMetaOpen}
          published={published} onTogglePublished={onTogglePublished}
          season={season} setSeason={setSeason}
          tagMgmt={tagMgmt} categoryMgmt={categoryMgmt}
          onDelete={onDelete} setConfirmDel={setConfirmDel}
        />
      )}

      {/* ── Gekoppelde competities ───────────────────────────────── */}
      {linkMgmt.links.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, padding: 24 }}>
          Nog geen competities gekoppeld.
        </div>
      ) : linkMgmt.links.map(lnk => (
        <CompetitionRow
          key={lnk.id}
          lnk={lnk}
          globalTags={tagMgmt.globalTags}
          onAssignTag={tagId => linkMgmt.handleAssignTag(lnk, tagId)}
          onRemoveTag={tagId => linkMgmt.handleRemoveCompTag(lnk, tagId)}
          onToggleVisible={() => linkMgmt.handleToggleVisible(lnk)}
          onToggleScanProfile={() => linkMgmt.handleToggleScanProfile(lnk)}
          onRemove={() => linkMgmt.setConfirmLink(lnk)}
          onOpenDetail={() => linkMgmt.setSelectedLnk(lnk)}
        />
      ))}

      <CompetitiePicker
        showPicker={linkMgmt.showPicker} setShowPicker={linkMgmt.setShowPicker}
        selectedComps={linkMgmt.selectedComps} setSelectedComps={linkMgmt.setSelectedComps}
        adding={linkMgmt.adding} onBulkAdd={linkMgmt.handleBulkAdd} onAdd={linkMgmt.handleAdd}
        filterQ={linkMgmt.filterQ} setFilterQ={linkMgmt.setFilterQ}
        pickerComps={pickerComps} allComps={linkMgmt.allComps}
      />
    </div>
  )
}
