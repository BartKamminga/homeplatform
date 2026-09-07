import { useState, useEffect } from 'react'
import { getStatsForDay } from '../../api.js'
import StackedTimelineChart from './charts/StackedTimelineChart.jsx'
import RankingBarChart from './charts/RankingBarChart.jsx'

// item 1097: herbruikbaar "scan-activiteit"-paneel, per dag opvraagbaar
// vanuit de Kalender (ook niet-wedstrijddagen) - server-side gebucket
// (zie backend/routers/hockey_vanger_stats.py::stats_for_day), niet
// clientside de ruwe ScanScheduleEntry-rijen bucketen (op een drukke
// wedstrijddag al snel 1000+ rijen).
export default function ScanActivityPanel({ dateStr }) {
  const [data, setData]     = useState(null)
  const [open, setOpen]     = useState(false)

  useEffect(() => {
    setData(null)
    if (!open) return
    getStatsForDay(dateStr, 30).then(setData).catch(() => {})
  }, [dateStr, open])

  return (
    <div style={{ padding: '8px 14px', borderTop: '1px solid var(--color-border)' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <span>{open ? '▾' : '▸'}</span>
        SCAN-ACTIVITEIT
      </div>
      {open && (
        data ? (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <StackedTimelineChart buckets={data.buckets} reasonsPresent={data.reasons_present} height={180} />
            {data.top_targets.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 6 }}>TOP POULES/COMPETITIES</div>
                <RankingBarChart rows={data.top_targets} limit={12} />
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', padding: '8px 0' }}>Laden…</div>
        )
      )}
    </div>
  )
}
