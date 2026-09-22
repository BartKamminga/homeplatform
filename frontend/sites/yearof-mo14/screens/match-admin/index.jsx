import { useState, useEffect } from 'react'
import {
  getTimelineItemModeration, getPlayers,
  getReportsModeration, tagReport, untagReport, moveReport,
  getPhotosModeration, updatePhoto, deletePhoto, tagPhoto, untagPhoto,
  listContributorLinks,
  movePhotoBlock, listTeamLinks, createShortLink,
} from '../../api.js'
import { copyToClipboard } from '../../clipboard.js'
import { contributorLinkStatus } from '../../linkStatus.js'
import { PhotoModerationGrid } from '../PhotoModerationGrid.jsx'
import { ReportForm } from '../ReportForm.jsx'
import ContributeReport from '../ContributeReport.jsx'
import PublicEntry from '../PublicEntry.jsx'
import { ChooseReportKind } from './ChooseReportKind.jsx'
import { InviteLinkScreen } from './InviteLinkScreen.jsx'
import { InviteDetailScreen, INVITE_TYPE_LABEL as TYPE_LABEL } from './InviteDetailScreen.jsx'
import { LinksScreen } from './LinksScreen.jsx'
import { GoalsPanel } from './GoalsPanel.jsx'

export default function MatchAdminDetail({ matchRef, onBack }) {
  const [item, setItem] = useState(null)
  const [players, setPlayers] = useState([])
  const [reports, setReports] = useState([])
  const [photos, setPhotos] = useState([])
  const [links, setLinks] = useState([])
  const [error, setError] = useState('')
  const [view, setView] = useState('preview') // preview | choose | write | edit | invul | invite | fill-invite | links
  const [editingReport, setEditingReport] = useState(null)
  const [insertAfterId, setInsertAfterId] = useState(null)
  const [linksReportType, setLinksReportType] = useState('wedstrijd_beelden')
  const [activeInviteId, setActiveInviteId] = useState(null)
  const [showGoals, setShowGoals] = useState(false)
  const [showPhotos, setShowPhotos] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  async function resolveEntryLinkUrl() {
    const links = await listTeamLinks()
    const active = links.find(l => !l.revoked_at && (!l.expires_at || new Date(l.expires_at) > new Date()))
    if (!active) {
      setError('Geen actief teamlinkje - maak er eerst een aan bij Toegang.')
      return null
    }
    const link = await createShortLink({ team_code: active.id, match_ref: matchRef })
    return `${window.location.origin}/l/${link.id}`
  }

  async function copyEntryLink() {
    try {
      const url = await resolveEntryLinkUrl()
      if (!url) return
      await copyToClipboard(url)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch (e) {
      setError(e.message)
    }
  }

  async function openEntryLink() {
    try {
      const url = await resolveEntryLinkUrl()
      if (!url) return
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      setError(e.message)
    }
  }

  function loadReports() {
    getReportsModeration().then(rows => setReports(rows.filter(r => r.match_ref === matchRef))).catch(e => setError(e.message))
  }
  function loadPhotos() {
    getPhotosModeration().then(rows => setPhotos(rows.filter(p => p.match_ref === matchRef))).catch(e => setError(e.message))
  }
  function loadLinks() {
    listContributorLinks().then(rows => setLinks(rows.filter(l => l.match_ref === matchRef))).catch(() => {})
  }

  useEffect(() => {
    getTimelineItemModeration(matchRef).then(setItem).catch(e => setError(e.message))
    getPlayers().then(setPlayers).catch(() => {})
    loadReports()
    loadPhotos()
    loadLinks()
  }, [matchRef])

  function entryTitle() {
    return item?.title || matchRef
  }

  async function togglePhotoTag(p, playerId) {
    if (p.player_ids.includes(playerId)) await untagPhoto(p.id, playerId)
    else await tagPhoto(p.id, playerId)
    loadPhotos()
  }
  async function togglePublishPhoto(p) {
    await updatePhoto(p.id, { status: p.status === 'published' ? 'concept' : 'published' })
    loadPhotos()
  }
  async function deletePhotoRow(id) {
    await deletePhoto(id)
    loadPhotos()
  }
  async function savePhotoCaption(p, value) {
    await updatePhoto(p.id, { caption: value })
    loadPhotos()
  }
  async function togglePhotoHighlight(p) {
    await updatePhoto(p.id, { match_highlight: !p.match_highlight })
    loadPhotos()
  }
  async function bulkPublishPhotos(ids) {
    await Promise.all(ids.map(id => updatePhoto(id, { status: 'published' })))
    loadPhotos()
  }
  async function bulkDeletePhotos(ids) {
    await Promise.all(ids.map(id => deletePhoto(id)))
    loadPhotos()
  }

  function backToPreview() {
    setEditingReport(null)
    setInsertAfterId(null)
    setView('preview')
    loadReports()
    loadLinks()
  }

  function handleEditReport(report) {
    if (report.report_type === 'instagram' || report.report_type === 'wedstrijd_beelden') {
      setLinksReportType(report.report_type)
      setView('links')
      return
    }
    setEditingReport(report)
    setView('edit')
  }

  function addItemAt(afterId) {
    setInsertAfterId(afterId)
    setView('choose')
  }

  async function handleMoveReport(reportId, direction) {
    await moveReport(reportId, direction)
  }

  async function handleMovePhotoBlock(direction) {
    await movePhotoBlock(matchRef, direction)
  }

  async function toggleEditingReportTag(playerId) {
    if (!editingReport) return
    const tagged = (editingReport.player_ids || []).includes(playerId)
    if (tagged) await untagReport(editingReport.id, playerId)
    else await tagReport(editingReport.id, playerId)
    await refreshEditingReport()
  }

  async function refreshEditingReport() {
    if (!editingReport) return
    const fresh = await getReportsModeration()
    const updated = fresh.find(r => r.id === editingReport.id)
    if (updated) setEditingReport(updated)
    setReports(fresh.filter(r => r.match_ref === matchRef))
  }

  const linksExistingReport = reports.find(r => r.report_type === linksReportType)
  const activeInvite = links.find(l => l.id === activeInviteId)

  function playerName(id) {
    return players.find(p => p.id === id)?.nickname || players.find(p => p.id === id)?.name
  }
  const pendingInvites = links
    .filter(l => l.report_type === 'foto' ? !l.photo_count : !l.report_status)
    .map(l => {
      const status = contributorLinkStatus(l)
      const forWhom = l.player_id ? playerName(l.player_id) || 'speelster' : 'het team'
      return { id: l.id, title: `${TYPE_LABEL[l.report_type] || l.report_type} · ${forWhom}`, statusLabel: status.label, statusColor: status.color }
    })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button onClick={onBack} style={{ fontSize: 13, cursor: 'pointer', marginBottom: 10 }}>&larr; terug naar de lijst</button>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={copyEntryLink} className="yof-btn-secondary" style={{ fontSize: 12 }}>
            {linkCopied ? 'Link gekopieerd!' : '🔗 Kopieer wedstrijdlink'}
          </button>
          <button onClick={openEntryLink} className="yof-btn-secondary" style={{ fontSize: 12 }} title="Opent precies wat een bezoeker via de wedstrijdlink ziet (alleen highlights)">
            👁 Bekijk wedstrijdlink
          </button>
        </div>
      </div>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      {item && <h3 style={{ fontSize: 16, margin: '0 0 4px' }}>{item.title}</h3>}
      {item && <p style={{ fontSize: 12, color: '#666', margin: '0 0 16px' }}>{item.date?.slice(0, 10)} &middot; {item.kind}</p>}

      {view === 'choose' && (
        <ChooseReportKind
          onWriteMyself={() => setView('write')}
          onSendInvite={() => setView('invul')}
          onAddInstagram={() => { setLinksReportType('instagram'); setView('links') }}
          onAddFootage={() => { setLinksReportType('wedstrijd_beelden'); setView('links') }}
          onBack={() => { setInsertAfterId(null); setView('preview') }}
        />
      )}
      {view === 'write' && (
        <ReportForm fixedMatchRef={matchRef} fixedMatchTitle={entryTitle()} insertAfterId={insertAfterId}
          onSaved={backToPreview} onCancel={() => setView('choose')} />
      )}
      {view === 'edit' && editingReport && (
        <ReportForm
          fixedMatchRef={matchRef} fixedMatchTitle={entryTitle()} existingReport={editingReport}
          players={players} onToggleTag={toggleEditingReportTag}
          onSaved={backToPreview} onCancel={backToPreview} onDeleted={backToPreview} onRefresh={refreshEditingReport}
        />
      )}
      {view === 'invul' && (
        <InviteLinkScreen matchRef={matchRef} players={players} onBack={() => setView('choose')} />
      )}
      {view === 'invite' && (
        <InviteDetailScreen link={activeInvite} players={players}
          onBack={() => { setActiveInviteId(null); setView('preview') }}
          onDeleted={() => { setActiveInviteId(null); setView('preview'); loadLinks() }}
          onFill={() => setView('fill-invite')}
        />
      )}
      {view === 'fill-invite' && activeInvite && (
        <ContributeReport code={activeInvite.id} adminMode
          onBack={() => setView('invite')}
          onSaved={() => { setActiveInviteId(null); setView('preview'); loadReports(); loadLinks() }}
        />
      )}
      {view === 'links' && (
        <LinksScreen matchRef={matchRef} reportType={linksReportType} existingReport={linksExistingReport}
          insertAfterId={insertAfterId} onBack={backToPreview} onRefresh={loadReports} />
      )}

      {view === 'preview' && (
        <>
          <PublicEntry
            matchRef={matchRef} onBack={() => {}} previewMode adminMode
            onEditReport={handleEditReport}
            onAddItem={addItemAt}
            onMoveReport={handleMoveReport}
            onMovePhotoBlock={handleMovePhotoBlock}
            pendingInvites={pendingInvites}
            onOpenInvites={id => { setActiveInviteId(id); setView('invite') }}
          />

          <button onClick={() => setShowGoals(s => !s)} className="yof-btn-secondary" style={{ margin: '20px 0 8px', display: 'block' }}>
            {showGoals ? 'Verberg' : 'Toon'} doelpunten
          </button>
          {showGoals && (
            <div style={{ marginBottom: 20 }}>
              <GoalsPanel matchRef={matchRef} players={players} />
            </div>
          )}

          <button onClick={() => setShowPhotos(s => !s)} className="yof-btn-secondary" style={{ marginBottom: 8, display: 'block' }}>
            {showPhotos ? 'Verberg' : 'Toon'} fotobeheer ({photos.length})
          </button>
          {showPhotos && (
            <div style={{ marginBottom: 20 }}>
              <PhotoModerationGrid photos={photos} players={players} entryTitle={entryTitle}
                onTogglePublish={togglePublishPhoto} onDelete={deletePhotoRow} onToggleTag={togglePhotoTag} onSaveCaption={savePhotoCaption}
                onToggleHighlight={togglePhotoHighlight} onBulkPublish={bulkPublishPhotos} onBulkDelete={bulkDeletePhotos} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
