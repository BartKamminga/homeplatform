// Zelfde kaartstijl als de Poulebord-pouletabel (frontend/sites/poulebord/
// PouleCard.jsx + PoolTable.jsx), hier los nagebouwd i.p.v. cross-site
// geimporteerd - yearof-mo14 heeft geen pin/board-functionaliteit nodig en dit
// voorkomt een onnodige afhankelijkheid tussen 2 losse sites.
const C = {
  card:   '#10402f',
  chalk:  '#f3efe3',
  muted:  '#8fab9d',
  gold:   '#cf9f3f',
  goldBr: '#e8bf68',
  border: 'rgba(143,171,157,0.18)',
}

export function PouleCard({ title, rows, onOpen }) {
  const clickable = !!onOpen

  return (
    <div style={{ background: C.card, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}` }}>
      <button
        onClick={clickable ? onOpen : undefined}
        style={{
          display: 'block', width: '100%', padding: '6px 10px', fontSize: 11, fontWeight: 700,
          letterSpacing: '.08em', textTransform: 'uppercase', color: C.gold, borderBottom: `1px solid ${C.border}`,
          background: 'none', border: 'none', borderBottomColor: C.border, textAlign: 'left',
          cursor: clickable ? 'pointer' : 'default', fontFamily: 'inherit',
        }}>
        {title}{clickable && <span style={{ color: C.muted, fontSize: 10 }}> &rsaquo;</span>}
      </button>

      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '10px 0', fontStyle: 'italic' }}>
          Nog geen stand
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: C.muted, fontSize: 10 }}>
              <th style={{ padding: '4px 3px 4px 10px', textAlign: 'left', fontWeight: 500, width: 18 }}>#</th>
              <th style={{ padding: '4px 3px', textAlign: 'left', fontWeight: 500 }}>Team</th>
              <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 500, width: 22 }}>P</th>
              <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 500, width: 22 }}>W</th>
              <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 500, width: 22 }}>G</th>
              <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 500, width: 22 }}>V</th>
              <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 500, width: 44, whiteSpace: 'nowrap' }}>GV&ndash;GT</th>
              <th style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 500, width: 30, whiteSpace: 'nowrap' }}>DS</th>
              <th style={{ padding: '4px 10px 4px 6px', textAlign: 'center', fontWeight: 600, width: 28, color: C.chalk }}>Pt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.team_id} style={{
                borderTop: `1px solid ${C.border}`,
                background: r.is_us ? 'rgba(207,159,63,0.13)' : i === 0 ? 'rgba(207,159,63,0.07)' : 'transparent',
              }}>
                <td style={{ padding: '5px 3px 5px 10px', color: C.muted, fontSize: 11 }}>{i + 1}</td>
                <td style={{
                  padding: '5px 3px', color: r.is_us ? C.goldBr : C.chalk, fontWeight: r.is_us || i === 0 ? 600 : 400,
                  maxWidth: 0, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {r.club_logo_url && (
                    <img src={r.club_logo_url} alt="" style={{
                      width: 14, height: 14, borderRadius: '50%', objectFit: 'cover',
                      marginRight: 4, verticalAlign: 'middle', flexShrink: 0,
                    }} />
                  )}
                  {r.team_name}
                </td>
                <td style={{ padding: '5px 6px', textAlign: 'center', color: C.muted }}>{r.played}</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', color: C.muted }}>{r.won}</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', color: C.muted }}>{r.drawn}</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', color: C.muted }}>{r.lost}</td>
                <td style={{ padding: '5px 6px', textAlign: 'center', color: C.muted, fontSize: 11 }}>
                  {r.gf ?? 0}&ndash;{r.ga ?? 0}
                </td>
                <td style={{ padding: '5px 6px', textAlign: 'center', color: C.muted, fontSize: 11 }}>
                  {(() => { const ds = (r.gf ?? 0) - (r.ga ?? 0); return ds > 0 ? `+${ds}` : ds })()}
                </td>
                <td style={{ padding: '5px 10px 5px 6px', textAlign: 'center', color: C.goldBr, fontWeight: 700, fontSize: 13 }}>
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
