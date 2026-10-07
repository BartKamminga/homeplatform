import { useState, useEffect } from 'react'
import { getCompetitionStandings } from '../../api.js'
import PouleResults from './PouleResults.jsx'

// Hele MO14 Topklasse landelijk (item 1230): alle districten en poules met
// hun stand; klik op een poule = uitslagen en programma van die poule
// (zelfde blok als voor de eigen poule). Data: Poulebord-publicatie,
// competities met class_name "Topklasse".

const DISTRICT_ORDER = ['Zuid-Holland', 'Noord-Holland', 'Midden Nederland', 'Zuid Nederland', 'Noord-Oost Nederland']
const short = name => name.replace(' MO14-1', '').replace(' MO14-2', ' 2')

function sortRows(rows) {
  return [...rows].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf)
}

function PouleCard({ poule, district, teamId, open, onToggle }) {
  const rows = sortRows(poule.standings || [])
  const ours = rows.some(r => r.team_id === teamId)
  const cell = { padding: '3px 4px', textAlign: 'center' }
  return (
    <div className="yof-card" style={{ padding: 10, border: ours ? '2px solid #f4c81e' : '1px solid #e6e9f0' }}>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'baseline', gap: 6, border: 'none', background: 'none',
        cursor: 'pointer', padding: '0 0 6px', textAlign: 'left',
      }}>
        <strong style={{ fontSize: 13, flex: 1 }}>{district} · {poule.name}</strong>
        <span style={{ fontSize: 11, color: '#888' }}>{poule.matches_played}/{poule.matches_total} gespeeld {open ? '▾' : '▸'}</span>
      </button>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ color: '#999', fontSize: 11 }}>
            <th style={{ ...cell, textAlign: 'left' }}>#</th>
            <th style={{ ...cell, textAlign: 'left' }}>Team</th>
            <th style={cell}>G</th>
            <th style={cell}>W-G-V</th>
            <th style={cell} title="Doelsaldo">DS</th>
            <th style={{ ...cell, textAlign: 'right' }}>Pt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.team_id} style={{ borderTop: '1px solid #f0f0f0', background: r.team_id === teamId ? '#fdf8e8' : 'transparent', fontWeight: r.team_id === teamId ? 700 : 400 }}>
              <td style={{ ...cell, textAlign: 'left' }}>{poule.matches_played ? i + 1 : '-'}</td>
              <td style={{ ...cell, textAlign: 'left' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {r.club_logo_url
                    ? <img src={r.club_logo_url} alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }} />
                    : <span style={{ width: 16 }} />}
                  {short(r.team_name)}
                </span>
              </td>
              <td style={cell}>{r.played}</td>
              <td style={cell}>{r.won}-{r.drawn}-{r.lost}</td>
              <td style={cell}>{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td>
              <td style={{ ...cell, textAlign: 'right' }}>{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {open && <div style={{ marginTop: 8 }}><PouleResults pouleId={poule.id} teamName={rows.find(r => r.team_id === teamId)?.team_name} /></div>}
    </div>
  )
}

export default function TopklasseOverview({ tournamentId, teamId }) {
  const [poules, setPoules] = useState(null)
  const [district, setDistrict] = useState('')
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    getCompetitionStandings(tournamentId).then(d => {
      const list = (d.competitions || [])
        .filter(c => c.class_name === 'Topklasse')
        .flatMap(c => (c.poules || []).map(p => ({ ...p, district: c.district })))
        .sort((a, b) => DISTRICT_ORDER.indexOf(a.district) - DISTRICT_ORDER.indexOf(b.district) || a.name.localeCompare(b.name))
      setPoules(list)
      // Standaard het district van het eigen team
      const own = list.find(p => (p.standings || []).some(r => r.team_id === teamId))
      if (own) setDistrict(own.district)
    }).catch(() => setPoules([]))
  }, [tournamentId, teamId])

  if (!poules || poules.length === 0) return null
  const districts = [...new Set(poules.map(p => p.district))]
  const shown = poules.filter(p => !district || p.district === district)

  return (
    <div style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 4px' }}>Topklasse MO14 landelijk</h3>
      <p style={{ fontSize: 12, color: '#666', margin: '0 0 8px' }}>Alle Topklasse-poules. Klik op een poule voor de uitslagen en het programma.</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {['', ...districts].map(d => (
          <button key={d || 'all'} onClick={() => setDistrict(d)} style={{
            borderRadius: 999, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 700,
            border: district === d ? '2px solid #12203c' : '1px solid #ccd3e0',
            background: district === d ? '#12203c' : 'white', color: district === d ? 'white' : '#12203c',
          }}>
            {d || 'Alle districten'}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 10 }}>
        {shown.map(p => (
          <PouleCard key={p.id} poule={p} district={p.district} teamId={teamId}
            open={openId === p.id} onToggle={() => setOpenId(id => (id === p.id ? null : p.id))} />
        ))}
      </div>
    </div>
  )
}
