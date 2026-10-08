import { useState, useEffect } from 'react'
import {
  getTimelineItemModeration, getPlayers,
  getReportsModeration, tagReport, untagReport, moveReport,
  listContributorLinks,
  movePhotoBlock,
  createReportDirect, createContributorLink,
} from '../../api.js'
import { contributorLinkStatus } from '../../linkStatus.js'
import { onDataChanged } from '../../dataChanged.js'
import PhotoManager from '../../features/photos/PhotoManager.jsx'
import { ReportForm } from '../ReportForm.jsx'
import ContributeReport from '../ContributeReport.jsx'
import PublicEntry from '../PublicEntry.jsx'
import { InviteDetailScreen, INVITE_TYPE_LABEL as TYPE_LABEL } from './InviteDetailScreen.jsx'
import { LinksScreen } from './LinksScreen.jsx'
import { GoalsPanel } from './GoalsPanel.jsx'
import LinkPanel, { CreateShortLinkButton } from '../LinkPanel.jsx'
import InviteCreateForm from '../InviteCreateForm.jsx'

// pinnedPage (Parijs weekend, item 1239): eigen pagina zonder wedstrijd/dag -
// alleen berichten en foto's; geen doelpunten, wedstrijdlink of invullinks.
export default function MatchAdminDetail({ matchRef, onBack, pinnedPage = false, pageTitle }) {
  const [item, setItem] = useState(null)
  const [players, setPlayers] = useState([])
  const [reports, setReports] = useState([])
  const [links, setLinks] = useState([])
  const [error, setError] = useState('')
  const [view, setView] = useState('preview') // preview | choose | write | edit | invul | invite | fill-invite | links
  const [editingReport, setEditingReport] = useState(null)
  const [activeInviteId, setActiveInviteId] = useState(null)
  const [showGoals, setShowGoals] = useState(false)
  const [previewKey, setPreviewKey] = useState(0) // ophogen = wedstrijdpreview opnieuw laden
  const [showLinks, setShowLinks] = useState(false)

  function loadReports() {
    getReportsModeration().then(rows => setReports(rows.filter(r => r.match_ref === matchRef))).catch(e => setError(e.message))
  }
  function loadLinks() {
    listContributorLinks().then(rows => setLinks(rows.filter(l => l.match_ref === matchRef))).catch(() => {})
  }

  useEffect(() => {
    if (pinnedPage) setItem({ title: pageTitle || 'Pagina', kind: 'pagina' })
    else getTimelineItemModeration(matchRef).then(setItem).catch(e => setError(e.message))
    getPlayers().then(setPlayers).catch(() => {})
    loadReports()
    loadLinks()
  }, [matchRef])

  // Na elke opslag (ook elders, bv. een invullink via Linkjes & bezoeken) de
  // invullinks en berichten opnieuw ophalen - anders verschijnt de plaatshouder
  // van een nieuwe invullink pas na herladen (item 1239).
  useEffect(() => onDataChanged(() => { loadLinks(); loadReports() }), [matchRef])

  function entryTitle() {
    return item?.title || matchRef
  }

  function backToPreview() {
    setEditingReport(null)
    setView('preview')
    loadReports()
    loadLinks()
  }

  function handleEditReport(report) {
    // Er kunnen meerdere Instagram-/beeldenblokken zijn: altijd dit ene blok bewerken.
    setEditingReport(report)
    setView(report.report_type === 'instagram' || report.report_type === 'wedstrijd_beelden' ? 'links' : 'edit')
  }

  // Keuzebalk (item 1239): een keuze maakt meteen een conceptblok aan op de
  // gekozen plek; invullen gaat via Bewerken op het blok (invullink: via de plaatshouder).
  async function addItemAt(afterId, kind) {
    const block = (report_type, title) => createReportDirect({
      match_ref: matchRef, report_type, title, body: '', status: 'concept', links: [], insert_after_id: afterId,
    })
    try {
      if (kind === 'self') await block(pinnedPage ? 'nieuws' : 'wedstrijdverslag', pinnedPage ? 'Nieuw bericht' : 'Nieuw verslag')
      else if (kind === 'instagram') await block('instagram', 'Instagram')
      else if (kind === 'footage') await block('wedstrijd_beelden', 'Wedstrijdbeelden')
      else if (kind === 'invite_report') await createContributorLink({ match_ref: matchRef, report_type: 'wedstrijdverslag' })
      else if (kind === 'invite_photos') await createContributorLink({ match_ref: matchRef, report_type: 'foto' })
      setPreviewKey(k => k + 1)
    } catch (e) {
      setError(e.message)
    }
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
      {onBack && <button onClick={onBack} style={{ fontSize: 13, cursor: 'pointer', marginBottom: 10 }}>&larr; terug naar de lijst</button>}
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      {item && !pinnedPage && <h3 style={{ fontSize: 16, margin: '0 0 4px' }}>{item.title}</h3>}
      {item && !pinnedPage && <p style={{ fontSize: 12, color: '#666', margin: '0 0 16px' }}>{item.date?.slice(0, 10)} &middot; {item.kind}</p>}

      {view === 'edit' && editingReport && (
        <ReportForm
          fixedMatchRef={matchRef} fixedMatchTitle={entryTitle()} existingReport={editingReport} allowNews={pinnedPage} controlsOnBar
          players={players} onToggleTag={toggleEditingReportTag}
          onSaved={backToPreview} onCancel={backToPreview} onDeleted={backToPreview} onRefresh={refreshEditingReport}
        />
      )}
      {view === 'invite' && (
        <InviteDetailScreen link={activeInvite} players={players}
          onBack={() => { setActiveInviteId(null); setView('preview') }}
          onDeleted={() => { setActiveInviteId(null); setView('preview'); loadLinks() }}
          onChanged={loadLinks}
          onFill={() => setView('fill-invite')}
        />
      )}
      {view === 'fill-invite' && activeInvite && (
        <ContributeReport code={activeInvite.id} adminMode
          onBack={() => setView('invite')}
          onSaved={() => { setActiveInviteId(null); setView('preview'); loadReports(); loadLinks() }}
        />
      )}
      {view === 'links' && editingReport && (
        <LinksScreen reportType={editingReport.report_type} existingReport={editingReport}
          onBack={backToPreview} onRefresh={refreshEditingReport} />
      )}

      {view === 'preview' && (
        <>
          <PublicEntry key={previewKey}
            matchRef={matchRef} onBack={() => {}} previewMode adminMode
            onEditReport={handleEditReport}
            onAddItem={addItemAt}
            // Fotobeheer (item 1213) klapt open onder het blok Foto's zelf (item 1239)
            renderPhotoManager={onChanged => <PhotoManager matchRef={matchRef} onChanged={onChanged} />}
            // Eigen pagina: geen invullinks (die horen bij een wedstrijd)
            addKinds={pinnedPage ? ['self', 'instagram', 'footage'] : undefined}
            onMoveReport={handleMoveReport}
            onMovePhotoBlock={handleMovePhotoBlock}
            pendingInvites={pendingInvites}
            onOpenInvites={id => { setActiveInviteId(id); setView('invite') }}
          />

          {!pinnedPage && <>
          <button onClick={() => setShowGoals(s => !s)} className="yof-btn-secondary" style={{ margin: '20px 0 8px', display: 'block' }}>
            {showGoals ? 'Verberg' : 'Toon'} doelpunten
          </button>
          {showGoals && (
            <div style={{ marginBottom: 20 }}>
              <GoalsPanel matchRef={matchRef} players={players} />
            </div>
          )}

          <button onClick={() => setShowLinks(s => !s)} className="yof-btn-secondary" style={{ marginBottom: 8, display: 'block' }}>
            {showLinks ? 'Verberg' : 'Toon'} linkjes &amp; bezoeken
          </button>
          {showLinks && (
            <div style={{ marginBottom: 20 }}>
              <LinkPanel kinds={['match', 'contribute']} filter={l => l.match_ref === matchRef} actions={{
                // Wedstrijdlink voor de Vrienden-van-groep (item 1186): eigen token, 10 dagen
                // geldig. Kopieer/Bekijk/Intrekken staan in de rij van de link.
                match: (rows, reload) => (
                  <CreateShortLinkButton rows={rows} body={{ match_ref: matchRef }} label="Maak wedstrijdlink" onCreated={reload} />
                ),
                contribute: (_, reload) => <InviteCreateForm matchRef={matchRef} players={players} onCreated={reload} />,
              }} />
            </div>
          )}
          </>}
        </>
      )}
    </div>
  )
}
