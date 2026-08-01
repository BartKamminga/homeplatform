export default function DiscStandingsTable({ poule }) {
  const rows    = poule.standings || []
  const pending = poule.teams_pending || []

  if (rows.length === 0) {
    if (pending.length === 0) return (
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '6px 10px' }}>
        Nog geen stand
      </div>
    )
    return (
      <div>
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '5px 10px 3px' }}>
          Nog geen stand — deelnemende teams:
        </div>
        {pending.map((name, i) => (
          <div key={i} style={{ fontSize: 12, padding: '4px 10px', borderTop: '1px solid var(--color-border)', color: 'var(--color-text)' }}>{name}</div>
        ))}
      </div>
    )
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>
          <th style={{ padding: '3px 3px 3px 8px', textAlign: 'left', width: 18 }}>#</th>
          <th style={{ padding: '3px 3px', textAlign: 'left' }}>Team</th>
          <th style={{ padding: '3px 6px', textAlign: 'center', width: 24 }}>W</th>
          <th style={{ padding: '3px 6px', textAlign: 'center', width: 24 }}>G</th>
          <th style={{ padding: '3px 6px', textAlign: 'center', width: 24 }}>V</th>
          <th style={{ padding: '3px 8px 3px 3px', textAlign: 'center', width: 30, fontWeight: 600, color: 'var(--color-text)' }}>Pt</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ borderTop: '1px solid var(--color-border)', background: i === 0 ? 'rgba(var(--color-primary-rgb, 46,125,50),0.06)' : 'transparent' }}>
            <td style={{ padding: '4px 3px 4px 8px', color: 'var(--color-text-muted)', fontSize: 11 }}>{i + 1}</td>
            <td style={{ padding: '4px 3px', maxWidth: 0, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: i === 0 ? 600 : 400 }}>{r.team_name}</td>
            <td style={{ padding: '4px 6px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{r.won}</td>
            <td style={{ padding: '4px 6px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{r.drawn}</td>
            <td style={{ padding: '4px 6px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{r.lost}</td>
            <td style={{ padding: '4px 8px 4px 3px', textAlign: 'center', fontWeight: 700 }}>{r.pts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
