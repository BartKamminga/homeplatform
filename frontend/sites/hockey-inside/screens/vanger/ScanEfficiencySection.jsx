import { useState, useEffect } from 'react'
import { getStatsSummary } from '../../api.js'
import { REASON_META } from './reasonMeta.js'
import StackedTimelineChart from './charts/StackedTimelineChart.jsx'

// item 1108: scanschema (ScanScheduleEntry, gepland) + cmd-queue-uitkomst
// (ScanHistoryDaily, echt uitgevoerd) samengevat tot 1 grafiek + overzicht -
// systeembreed, geen competitie/dag-filter (dat is wat dit onderscheidt van
// het per-dag-paneel in de Kalender en het per-competitie-tabblad).
export default function ScanEfficiencySection({ section }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    getStatsSummary(30).then(setData).catch(() => {})
  }, [])

  if (!data) return null

  const buckets = data.daily_totals.map(d => ({ bucket: d.date.slice(5), by_reason: d.by_reason, total: d.total }))
  const reasonsPresent = [...new Set(data.daily_totals.flatMap(d => Object.keys(d.by_reason || {})))]

  return (
    <div>
      {section(`Scan-efficiëntie (${data.days}d)`)}
      <StackedTimelineChart buckets={buckets} reasonsPresent={reasonsPresent} height={200} />
      {data.outcome_by_reason.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {data.outcome_by_reason.map(r => {
            const total = r.success + r.failed
            const pct = total > 0 ? Math.round((r.success / total) * 100) : 0
            return (
              <div key={r.reason} style={{
                fontSize: 11, padding: '4px 9px', borderRadius: 8,
                border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: REASON_META[r.reason]?.color || '#94a3b8', display: 'inline-block' }} />
                <span style={{ color: 'var(--color-text-muted)' }}>{REASON_META[r.reason]?.label || r.reason}</span>
                <span style={{ fontWeight: 600 }}>{pct}%</span>
                {r.failed > 0 && <span style={{ color: 'var(--color-danger)' }}>({r.failed} mislukt)</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
