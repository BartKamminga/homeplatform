import { useState } from 'react'
import { getReportsModeration, tagReport, untagReport } from '../../api.js'
import { ReportForm } from '../ReportForm.jsx'
import { LinksScreen } from './LinksScreen.jsx'

// Editor die in het bewerkscherm tijdelijk de inhoud van een berichtblok
// vervangt (item 1258): Instagram/Wedstrijdbeelden = linkjes, de rest = tekst.
// Houdt een eigen verse kopie van het bericht bij (tags en linkjes slaan meteen op).
export default function InlineReportEditor({ report, matchRef, matchTitle, players, allowNews, onDone }) {
  const [current, setCurrent] = useState(report)

  async function refresh() {
    const fresh = (await getReportsModeration()).find(r => r.id === report.id)
    if (fresh) setCurrent(fresh)
  }

  async function toggleTag(playerId) {
    if ((current.player_ids || []).includes(playerId)) await untagReport(current.id, playerId)
    else await tagReport(current.id, playerId)
    await refresh()
  }

  if (current.report_type === 'instagram' || current.report_type === 'wedstrijd_beelden') {
    return <LinksScreen reportType={current.report_type} existingReport={current} onDone={onDone} onRefresh={refresh} />
  }
  return (
    <div className="yof-card" style={{ marginBottom: 10 }}>
      <ReportForm inline controlsOnBar
        fixedMatchRef={matchRef} fixedMatchTitle={matchTitle} existingReport={current} allowNews={allowNews}
        players={players} onToggleTag={toggleTag}
        onSaved={onDone} onCancel={onDone} onDeleted={onDone} onRefresh={refresh}
      />
    </div>
  )
}
