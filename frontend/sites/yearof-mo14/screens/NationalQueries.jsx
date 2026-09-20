import { useState, useEffect } from 'react'
import { getNationalRanking, getNationalUpcomingMatches } from '../api.js'

const OUR_TEAM_NAME = 'Victoria MO14-1'

// Zelfde 7 stat-varianten en labels als poulebord's Ranglijst-widget
// (frontend/sites/poulebord/QueryCard.jsx, STATS_BY_TEMPLATE.ranking) -
// item 1170: dezelfde selectie hier tonen, maar dan onopvallend (alleen de
// district-tag, niet niveau/Autoscan) en op mo14 a paris zelf i.p.v. alleen
// in poulebord.
const RANKING_STATS = [
  { key: 'points', label: 'Punten' },
  { key: 'goal_diff', label: 'Doelsaldo' },
  { key: 'goals_for', label: 'Doelpunten voor' },
  { key: 'goals_against', label: 'Doelpunten tegen (minste eerst)' },
  { key: 'won', label: 'Overwinningen' },
  { key: 'drawn', label: 'Gelijke spelen' },
  { key: 'streak', label: 'Winstreak' },
]

function districtTag(tags) {
  return tags?.find(t => t.category === 'Regio') || null
}

export default function NationalQueries() {
  const [stat, setStat] = useState('points')
  const [rows, setRows] = useState(null)
  const [upcoming, setUpcoming] = useState(null)

  useEffect(() => {
    getNationalRanking(stat, 10).then(res => setRows(res.rows)).catch(() => setRows([]))
  }, [stat])

  useEffect(() => {
    getNationalUpcomingMatches(5).then(res => setUpcoming(res.rows)).catch(() => setUpcoming([]))
  }, [])

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{ fontSize: 15, margin: 0 }}>Landelijke ranglijst &middot; MO14 Topklasse</h3>
        <select value={stat} onChange={e => setStat(e.target.value)} style={{ fontSize: 12, padding: '3px 6px' }}>
          {RANKING_STATS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {rows?.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#888' }}>
              <th style={{ padding: '4px 6px' }}>#</th>
              <th style={{ padding: '4px 6px' }}>Team</th>
              <th style={{ padding: '4px 6px', textAlign: 'right' }}>{RANKING_STATS.find(s => s.key === stat)?.label}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const tag = districtTag(r.tags)
              return (
                <tr key={`${r.team_name}-${r.rank}`} style={{
                  borderTop: '1px solid #eee',
                  fontWeight: r.team_name === OUR_TEAM_NAME ? 700 : 400,
                  background: r.team_name === OUR_TEAM_NAME ? '#fdf8e8' : 'transparent',
                }}>
                  <td style={{ padding: '4px 6px' }}>{r.rank}</td>
                  <td style={{ padding: '4px 6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {r.club_logo_url && <img src={r.club_logo_url} alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }} />}
                      {r.team_name}
                      {tag && (
                        <span style={{ fontSize: 10, color: '#999', border: '1px solid #ddd', borderRadius: 999, padding: '1px 6px' }}>
                          {tag.name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '4px 6px', textAlign: 'right' }}>{r[stat]}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {rows?.length === 0 && <p style={{ color: '#666', fontSize: 13 }}>Geen data beschikbaar.</p>}

      {upcoming?.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Belangrijke wedstrijd op komst &middot; MO14 Topklasse</h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {upcoming.map(m => {
              const tag = districtTag(m.tags)
              const isUs = m.home_team === OUR_TEAM_NAME || m.away_team === OUR_TEAM_NAME
              return (
                <div key={`${m.home_team}-${m.away_team}-${m.rank}`} className="yof-card" style={{
                  padding: '8px 10px', fontSize: 13, fontWeight: isUs ? 700 : 400,
                  background: isUs ? '#fdf8e8' : undefined,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span>{m.home_team} &ndash; {m.away_team}</span>
                    {tag && (
                      <span style={{ fontSize: 10, color: '#999', border: '1px solid #ddd', borderRadius: 999, padding: '1px 6px', flexShrink: 0 }}>
                        {tag.name}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    #{m.home_position}: {m.home_points}p &middot; #{m.away_position}: {m.away_points}p &middot; {m.type}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
