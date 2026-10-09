import { useState, useEffect } from 'react'
import {
  getTimelineItemModeration, getPlayers,
  getReportsModeration, moveReport,
  listContributorLinks,
  movePhotoBlock,
  createReportDirect, createContributorLink,
} from '../../api.js'
import { contributorLinkStatus } from '../../linkStatus.js'
import { onDataChanged } from '../../dataChanged.js'
import PhotoManager from '../../features/photos/PhotoManager.jsx'
import ContributeReport from '../ContributeReport.jsx'
import PublicEntry from '../PublicEntry.jsx'
import { InviteDetailScreen, INVITE_TYPE_LABEL as TYPE_LABEL } from './InviteDetailScreen.jsx'
import InlineReportEditor from './InlineReportEditor.jsx'
import MatchHeader from './MatchHeader.jsx'

// pinnedPage (Parijs weekend, item 1239): eigen pagina zonder wedstrijd/dag -
// alleen berichten en foto's; geen doelpunten, wedstrijdlink of invullinks.
export default function MatchAdminDetail({ matchRef, onBack, pinnedPage = false, pageTitle }) {
  const [item, setItem] = useState(null)
  const [players, setPlayers] = useState([])
  const [reports, setReports] = useState([])
  const [links, setLinks] = useState([])
  const [error, setError] = useState('')
  const [view, setView] = useState('preview') // preview | invite | fill-invite
  const [activeInviteId, setActiveInviteId] = useState(null)
  const [previewKey, setPreviewKey] = useState(0) // ophogen = wedstrijdpreview opnieuw laden

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
      // Doelpunten als blok: start als concept, invullen via Bewerken (spelerslijst)
      else if (kind === 'goals') await block('doelpunten', 'Doelpunten')
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
      {item && !pinnedPage && view === 'preview' && <MatchHeader item={item} matchRef={matchRef} players={players} />}

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
      {view === 'preview' && (
        <>
          <PublicEntry key={previewKey}
            matchRef={matchRef} onBack={() => {}} previewMode adminMode
            // Bewerken in het blok zelf (item 1258): de editor vervangt tijdelijk de inhoud
            renderReportEditor={(report, done) => (
              <InlineReportEditor key={report.id} report={report} matchRef={matchRef} matchTitle={entryTitle()}
                players={players} allowNews={pinnedPage} onDone={done} />
            )}
            onAddItem={addItemAt}
            // Fotobeheer (item 1213) vervangt in bewerking het overzicht in het blok (item 1258)
            renderPhotoManager={onChanged => <PhotoManager compact matchRef={matchRef} onChanged={onChanged} />}
            // Eigen pagina: geen invullinks (die horen bij een wedstrijd)
            addKinds={pinnedPage ? ['self', 'instagram', 'footage'] : undefined}
            onMoveReport={handleMoveReport}
            onMovePhotoBlock={handleMovePhotoBlock}
            pendingInvites={pendingInvites}
            onOpenInvites={id => { setActiveInviteId(id); setView('invite') }}
          />

        </>
      )}
    </div>
  )
}
