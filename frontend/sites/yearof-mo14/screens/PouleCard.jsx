// Zelfde kaartstijl als de rest van de publieke site (.yof-card: wit, afgeronde
// hoeken, navy/goud-accenten) i.p.v. de donkergroene Poulebord-tabelstijl.
export function PouleCard({ title, rows, onOpen }) {
  const clickable = !!onOpen

  return (
    <div className="yof-card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        onClick={clickable ? onOpen : undefined}
        style={{
          display: 'block', width: '100%', padding: '10px 14px', fontSize: 11, fontWeight: 700,
          letterSpacing: '.05em', textTransform: 'uppercase', color: '#999', borderBottom: '1px solid #eee',
          background: 'none', border: 'none', borderBottomColor: '#eee', textAlign: 'left',
          cursor: clickable ? 'pointer' : 'default', fontFamily: 'inherit',
        }}>
        {title}{clickable && <span style={{ color: '#bbb' }}> &rsaquo;</span>}
      </button>

      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: '10px 0', fontStyle: 'italic' }}>
          Nog geen stand
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: '#999', fontSize: 10 }}>
              <th style={{ padding: '4px 3px 4px 12px', textAlign: 'left', fontWeight: 500, width: 18 }}>#</th>
              <th style={{ padding: '4px 3px', textAlign: 'left', fontWeight: 500 }}>Team</th>
              <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 500, width: 22 }}>P</th>
              <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 500, width: 22 }}>W</th>
              <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 500, width: 22 }}>G</th>
              <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 500, width: 22 }}>V</th>
              <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 500, width: 44, whiteSpace: 'nowrap' }}>GV&ndash;GT</th>
              <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 500, width: 30, whiteSpace: 'nowrap' }}>DS</th>
              <th style={{ padding: '4px 12px 4px 6px', textAlign: 'center', fontWeight: 600, width: 28, color: '#12203c' }}>Pt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.team_id} style={{
                borderTop: '1px solid #f0f0f0',
                background: r.is_us ? 'rgba(244,200,30,.15)' : i === 0 ? 'rgba(244,200,30,.06)' : 'transparent',
              }}>
                <td style={{ padding: '6px 3px 6px 12px', color: '#999', fontSize: 11 }}>{i + 1}</td>
                <td style={{
                  padding: '6px 3px', color: '#12203c', fontWeight: r.is_us || i === 0 ? 700 : 400,
                  maxWidth: 0, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {r.club_logo_url && (
                    <img src={r.club_logo_url} alt="" style={{
                      width: 16, height: 16, borderRadius: '50%', objectFit: 'cover',
                      marginRight: 5, verticalAlign: 'middle', flexShrink: 0,
                    }} />
                  )}
                  {r.team_name}
                </td>
                <td style={{ padding: '6px 6px', textAlign: 'center', color: '#666' }}>{r.played}</td>
                <td style={{ padding: '6px 6px', textAlign: 'center', color: '#666' }}>{r.won}</td>
                <td style={{ padding: '6px 6px', textAlign: 'center', color: '#666' }}>{r.drawn}</td>
                <td style={{ padding: '6px 6px', textAlign: 'center', color: '#666' }}>{r.lost}</td>
                <td style={{ padding: '6px 6px', textAlign: 'center', color: '#666', fontSize: 11 }}>
                  {r.gf ?? 0}&ndash;{r.ga ?? 0}
                </td>
                <td style={{ padding: '6px 6px', textAlign: 'center', color: '#666', fontSize: 11 }}>
                  {(() => { const ds = (r.gf ?? 0) - (r.ga ?? 0); return ds > 0 ? `+${ds}` : ds })()}
                </td>
                <td style={{ padding: '6px 12px 6px 6px', textAlign: 'center', color: '#12203c', fontWeight: 700, fontSize: 13 }}>
                  {r.pts}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
