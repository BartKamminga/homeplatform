import { useState, useEffect } from 'react'
import { getPlayers, getReportsModeration, getTimelineModeration, tagReport, untagReport } from '../../api.js'
import { ReportForm } from '../../screens/ReportForm.jsx'
import { LinksScreen } from '../../screens/match-admin/LinksScreen.jsx'

// 1 bericht bewerken vanuit een pagina in de beheerstudio (item 1239) - ook
// berichten die bij een wedstrijd horen, zonder eerst naar die wedstrijd te
// moeten. reportId leeg = nieuw (algemeen) bericht.
export default function ReportEditor({ reportId, onDone }) {
  const [report, setReport] = useState(null)
  const [players, setPlayers] = useState([])
  const [matchTitle, setMatchTitle] = useState('')
  const [error, setError] = useState('')

  async function reload() {
    const rows = await getReportsModeration()
    const found = rows.find(r => r.id === reportId)
    if (!found) throw new Error('Bericht niet gevonden')
    setReport(found)
    return found
  }

  useEffect(() => {
    getPlayers().then(setPlayers).catch(() => {})
    if (!reportId) return
    reload()
      .then(found => {
        if (!found.match_ref) return
        getTimelineModeration()
          .then(items => setMatchTitle(items.find(it => it.match_ref === found.match_ref)?.title || ''))
          .catch(() => {})
      })
      .catch(e => setError(e.message))
  }, [reportId])

  async function toggleTag(playerId) {
    const tagged = (report.player_ids || []).includes(playerId)
    if (tagged) await untagReport(report.id, playerId)
    else await tagReport(report.id, playerId)
    await reload()
  }

  if (error) return <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>
  if (!reportId) return <ReportForm defaultReportType="nieuws" onSaved={onDone} onCancel={onDone} />
  if (!report) return null

  // Instagram/wedstrijdbeelden zijn linkjes-berichten met een eigen scherm.
  if (report.report_type === 'instagram' || report.report_type === 'wedstrijd_beelden') {
    return <LinksScreen reportType={report.report_type} existingReport={report}
      onBack={onDone} onRefresh={reload} />
  }

  return (
    <ReportForm
      existingReport={report} players={players} onToggleTag={toggleTag} controlsOnBar
      fixedMatchRef={report.match_ref || undefined} fixedMatchTitle={matchTitle}
      onSaved={onDone} onCancel={onDone} onDeleted={onDone} onRefresh={reload}
    />
  )
}
