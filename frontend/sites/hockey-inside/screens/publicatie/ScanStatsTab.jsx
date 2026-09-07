import { mutedText } from '../styles.js'
import { getCompetitionStats } from '../../api.js'
import { useAsyncData } from './hooks/useAsyncData.jsx'
import StackedTimelineChart from '../vanger/charts/StackedTimelineChart.jsx'
import RankingBarChart from '../vanger/charts/RankingBarChart.jsx'

const emptyState = { padding: 20, ...mutedText(13) }

// item 1096b: scan-stats voor 1 competitie als grafiek i.p.v. kale tabel -
// "maak er maar een grafiek ding van" (Bart). Eigen bestand (niet inline in
// CompetitieDetailView.jsx) omdat het een grafiek-component bevat, zelfde
// regel als bij ../vanger/ScanEfficiencySection.jsx.
export default function ScanStatsTab({ lnk }) {
  const { data, loading } = useAsyncData(
    () => getCompetitionStats(lnk.competition_id, 30).catch(() => null),
    [lnk.competition_id], null,
  )

  if (loading) return <div style={emptyState}>Laden…</div>
  if (!data) return <div style={emptyState}>Geen scan-stats beschikbaar.</div>

  // /stats/competition/{id} geeft geen per-reason-breakdown (dat is alleen
  // relevant systeembreed/per-dag, zie ScanEfficiencySection/ScanActivityPanel) -
  // hier dus 1 generieke "scans"-serie i.p.v. een lege stack.
  const buckets = data.daily_totals.map(d => ({ bucket: d.date.slice(5), by_reason: { scans: d.total }, total: d.total }))
  const rankingRows = data.poules
    .filter(p => p.scan_count > 0)
    .sort((a, b) => b.scan_count - a.scan_count)
    .map(p => ({ label: p.name, total: p.scan_count }))
  const { success, failed, unknown } = data.outcome
  const outcomeTotal = success + failed + unknown

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 6 }}>
          SCANS PER DAG ({data.days}d)
        </div>
        <StackedTimelineChart buckets={buckets} reasonsPresent={['scans']} height={180} />
      </div>

      {rankingRows.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 6 }}>PER POULE</div>
          <RankingBarChart rows={rankingRows} limit={20} />
        </div>
      )}

      {outcomeTotal > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 6 }}>UITKOMST</div>
          {unknown > 0 && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
              "?" = nog geen success/failed-uitkomst bekend (bv. nog pending, of van vóór 07-09-2026 - toen begon de permanente per-poule-telling).
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--color-border)', color: 'var(--color-success)' }}>✓ {success}</span>
            <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--color-border)', color: 'var(--color-danger)' }}>✗ {failed}</span>
            <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>? {unknown}</span>
          </div>
        </div>
      )}
    </div>
  )
}
