import { useState, useEffect } from 'react'
import { getTimelineItem, getTimelineItemModeration, getReports, getReportsModeration, getPhotos, getPhotosModeration, updateReport, deleteReport, restoreReport, getPhotoBlockPosition, likeReport, unlikeReport } from '../api.js'
import { LinkTiles } from './ReportLinks.jsx'
import PhotoGrid from '../features/photos/PhotoGrid.jsx'
import { LikeButton } from './LikeButton.jsx'
import FormattedText from './FormattedText.jsx'
import EntryHeader from './EntryHeader.jsx'
import ItemBar from '../features/blocks/ItemBar.jsx'
import GoalsCard from '../features/goals/GoalsCard.jsx'
import AddBar from '../features/blocks/AddBar.jsx'
import ArchivedReports from '../features/blocks/ArchivedReports.jsx'
import usePageBlocks from '../features/blocks/usePageBlocks.js'
import { useConfirm } from '@components/ConfirmDialog.jsx'

export default function PublicEntry({
  matchRef, onBack, previewMode = false, adminMode = false, standalone = false,
  renderReportEditor, onAddItem, addKinds, renderPhotoManager, onMoveReport, onMovePhotoBlock, pendingInvites = [], onOpenInvites,
}) {
  const [item, setItem] = useState(null)
  const [reports, setReports] = useState([])
  const [photos, setPhotos] = useState([])
  const [photoBlockSortOrder, setPhotoBlockSortOrder] = useState(-500)
  const [error, setError] = useState('')
  // Eigen pagina (bv. 'page:pinksterweekend', item 1239): zelfde berichten/foto's,
  // maar zonder wedstrijd/dag erachter - geen kop en geen terug-link.
  const isPage = matchRef.startsWith('page:')
  const [confirm, confirmDialog] = useConfirm()
  // Bewerken in het blok (item 1258): 1 blok tegelijk - 'photos' of het id van een bericht.
  // De editor vervangt zolang de inhoud van dat blok.
  const [editing, setEditing] = useState(null)
  function doneEditing() {
    setEditing(null)
    loadReports()
    loadPhotos()
  }
  const [insertAfter, setInsertAfter] = useState(null) // tussen-keuzebalk open na dit blok
  // Keuze = meteen een (concept)blok aanmaken (item 1239), invullen via Bewerken.
  const add = (afterId, kind) => { setInsertAfter(null); onAddItem(afterId, kind) }
  // Fotoblok van deze wedstrijd live/concept (item 1239), opgeslagen als blok "photos:<match_ref>".
  const { conceptBlocks, setBlockState } = usePageBlocks()
  const photosBlockId = `photos:${matchRef}`
  const photosLive = !conceptBlocks.has(photosBlockId)

  function loadReports() {
    const call = previewMode ? getReportsModeration() : getReports(matchRef, undefined, standalone)
    call
      .then(rows => {
        const filtered = previewMode ? rows.filter(r => r.match_ref === matchRef) : rows
        setReports([...filtered].sort((a, b) => a.sort_order - b.sort_order))
      })
      .catch(e => setError(e.message))
  }

  function loadPhotoBlockPosition() {
    getPhotoBlockPosition(matchRef).then(d => setPhotoBlockSortOrder(d.sort_order)).catch(() => {})
  }

  function loadPhotos() {
    // previewMode/adminMode: ook concept-fotos/video's tonen (bv. net
    // geupload via een invullinkje) - anders lijken ze "verdwenen" totdat
    // een beheerder ze los publiceert.
    const call = previewMode ? getPhotosModeration() : getPhotos(matchRef, standalone)
    call
      .then(rows => setPhotos(previewMode ? rows.filter(p => p.match_ref === matchRef) : rows))
      .catch(() => {})
  }

  useEffect(() => {
    if (!isPage) {
      const itemCall = adminMode ? getTimelineItemModeration(matchRef) : getTimelineItem(matchRef)
      itemCall.then(setItem).catch(e => setError(e.message))
    }
    loadReports()
    loadPhotoBlockPosition()
    loadPhotos()
  }, [matchRef])

  async function publish(report) {
    await updateReport(report.id, { status: 'published' })
    loadReports()
  }

  async function move(reportId, direction) {
    await onMoveReport(reportId, direction)
    loadReports()
  }

  // Bewerkscherm (item 1239): live/concept, wedstrijdlink en verwijderen op het blok zelf.
  async function changeReport(r, patch) {
    await updateReport(r.id, patch)
    loadReports()
  }
  async function removeReport(r) {
    if (!(await confirm(`"${r.title}" archiveren? Je kunt het terugzetten via Archief onderaan de pagina.`))) return
    await deleteReport(r.id)
    loadReports()
  }
  async function restore(r) {
    await restoreReport(r.id)
    loadReports()
  }
  // Gearchiveerde berichten (item 1239) staan niet op de pagina, alleen in het archief van het bewerkscherm.
  const liveReports = reports.filter(r => !r.archived_at)

  async function movePhotos(direction) {
    await onMovePhotoBlock(direction)
    loadPhotoBlockPosition()
    loadReports()
  }

  if (error) return <p style={{ color: '#c23b3b' }}>{error}</p>
  if (!item && !isPage) return <p>Laden...</p>

  return (
    <div>
      {!adminMode && !standalone && !isPage && (
        <a className="yof-back" href="#" onClick={e => { e.preventDefault(); onBack() }}>&larr; terug naar het overzicht</a>
      )}
      {!isPage && <EntryHeader item={item} />}

      {confirmDialog}

      {(() => {
        // Het generieke Foto's-blok toont bewust alleen gepubliceerde, niet
        // aan een verslag gekoppelde fotos - concepten (ook niet-toegewezen)
        // beheer je via het moderatie-overzicht verderop, anders overspoelt
        // een grote batch-upload deze preview volledig. Fotos die WEL bij
        // een verslag horen (report_id) tonen inline op dat verslag, incl.
        // concept-badge - daar wil je juist meteen zien of het gelukt is.
        const unassignedPublished = photos.filter(p => !p.report_id && p.status === 'published')
        const showPhotoBlock = (unassignedPublished.length > 0 && photosLive) || adminMode
        const blocks = []
        if (showPhotoBlock) blocks.push({ kind: 'photos', sort_order: photoBlockSortOrder })
        liveReports.forEach(r => blocks.push({ kind: 'report', report: r, sort_order: r.sort_order }))
        blocks.sort((a, b) => a.sort_order - b.sort_order)

        if (blocks.length === 0 && pendingInvites.length === 0) return null

        return (
      <div>
          {!isPage && <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Foto&rsquo;s, verslagen &amp; interviews</h3>}
          {pendingInvites.map(inv => (
            <div key={inv.id} onClick={() => onOpenInvites(inv.id)} className="yof-card"
              style={{
                marginBottom: 10, cursor: 'pointer', border: '2px dashed #ddd',
                boxShadow: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#999' }}>{inv.title}</div>
                <div style={{ fontSize: 12, color: '#999' }}>Nog niet ingevuld</div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, color: inv.statusColor, border: `1px solid ${inv.statusColor}`,
                borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap',
              }}>
                {inv.statusLabel}
              </span>
            </div>
          ))}
          {blocks.map((b, i) => {
            const atTop = i === 0
            const atBottom = i === blocks.length - 1

            if (b.kind === 'photos') {
              return (
                <div key="photos" style={{ marginBottom: 14, position: 'relative' }}>
                  {adminMode && (
                    <ItemBar label="Foto's"
                      live={photosLive}
                      onToggleLive={() => setBlockState(photosBlockId, !photosLive)}
                      onUp={atTop ? undefined : () => movePhotos('up')}
                      onDown={atBottom ? undefined : () => movePhotos('down')}
                      onEdit={renderPhotoManager && editing !== 'photos' ? () => setEditing('photos') : undefined} />
                  )}
                  {adminMode && editing === 'photos' && renderPhotoManager ? (
                    <div className="yof-card" style={{ marginBottom: 10 }}>
                      {renderPhotoManager(loadPhotos)}
                      <button className="yof-btn" onClick={doneEditing} style={{ marginTop: 10 }}>Done</button>
                    </div>
                  ) : (
                  <div style={{ opacity: adminMode && !photosLive ? 0.5 : 1 }}>
                  <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Foto&rsquo;s</h4>
                  {unassignedPublished.length > 0 ? <PhotoGrid photos={unassignedPublished} /> : (
                    <p style={{ color: '#666', fontSize: 13, margin: 0 }}>Nog geen foto&rsquo;s{isPage ? '' : ' voor deze wedstrijd'}.</p>
                  )}
                  </div>
                  )}
                </div>
              )
            }

            const r = b.report
            return (
              <div key={r.id}>
                {adminMode && (
                  <ItemBar label={r.title}
                    live={r.status === 'published'}
                    onToggleLive={() => changeReport(r, { status: r.status === 'published' ? 'concept' : 'published' })}
                    onMatchLink={r.match_highlight}
                    onToggleMatchLink={isPage ? undefined : () => changeReport(r, { match_highlight: !r.match_highlight })}
                    featured={r.featured}
                    onToggleFeatured={isPage ? () => changeReport(r, { featured: !r.featured }) : undefined}
                    onUp={atTop ? undefined : () => move(r.id, 'up')}
                    onDown={atBottom ? undefined : () => move(r.id, 'down')}
                    onEdit={renderReportEditor && editing !== r.id ? () => setEditing(r.id) : undefined}
                    onDelete={() => removeReport(r)} />
                )}
                {adminMode && editing === r.id && renderReportEditor ? renderReportEditor(r, doneEditing)
                  : r.report_type === 'doelpunten' ? (
                    <GoalsCard matchRef={matchRef} title={r.title} adminMode={adminMode} dimmed={adminMode && r.status === 'concept'}
                      onClick={adminMode && renderReportEditor ? () => setEditing(r.id) : undefined} />
                  ) : (
                <div className="yof-card"
                  onClick={adminMode && renderReportEditor ? () => setEditing(r.id) : undefined}
                  style={{ marginBottom: 10, position: 'relative', cursor: adminMode ? 'pointer' : 'default', opacity: adminMode && r.status === 'concept' ? 0.5 : 1 }}>
                  {r.status === 'concept' && !adminMode && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ background: '#fde68a', color: '#92400e', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                        CONCEPT
                      </span>
                      {!adminMode && (
                        <button onClick={() => publish(r)} className="yof-btn-secondary">Publiceren</button>
                      )}
                    </div>
                  )}
                  <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>{r.title}</h4>
                  {(r.author_name || r.published_at) && (
                    <p style={{ margin: '0 0 4px', fontSize: 12, color: '#666' }}>
                      {r.author_name && `door ${r.author_name}`}
                      {r.author_name && r.published_at && ' · '}
                      {r.published_at && new Date(r.published_at).toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}><FormattedText text={r.body} /></p>
                  {/* Foto's van een bericht: zelfde tonen-component als het fotoblok (item 1258) */}
                  <PhotoGrid photos={photos.filter(p => p.report_id === r.id)} min={70} showConcept />
                  <LinkTiles links={r.links} />
                  {!adminMode && (
                    <div style={{ marginTop: 6 }}>
                      <LikeButton kind="report" id={r.id} initialCount={r.like_count} likeFn={likeReport} unlikeFn={unlikeReport} />
                    </div>
                  )}
                </div>
                )}
                {adminMode && (insertAfter === r.id
                  ? <AddBar compact kinds={addKinds} onPick={kind => add(r.id, kind)} />
                  : (
                    <div style={{ textAlign: 'center', margin: '-4px 0 10px' }}>
                      <button onClick={() => setInsertAfter(r.id)}
                        style={{ fontSize: 11, color: '#999', background: 'none', border: 'none', cursor: 'pointer' }}>
                        + hier iets invoegen
                      </button>
                    </div>
                  ))}
              </div>
            )
          })}
          {adminMode && <AddBar kinds={addKinds} onPick={kind => add(null, kind)} />}
          {adminMode && <ArchivedReports reports={reports.filter(r => r.archived_at)} onRestore={restore} />}
      </div>
        )
      })()}
    </div>
  )
}
