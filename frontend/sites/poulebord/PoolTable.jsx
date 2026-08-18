import { C } from './constants.js'

function TeamName({ name, logoUrl, showLogos, highlighted }) {
  return (
    <>
      {showLogos && logoUrl && (
        <img src={logoUrl} alt="" style={{
          width: 14, height: 14, borderRadius: '50%', objectFit: 'cover',
          marginRight: 4, verticalAlign: 'middle', flexShrink: 0,
        }} />
      )}
      {highlighted && <span style={{ marginRight: 3, fontSize: 8 }}>▶</span>}
      {name}
    </>
  )
}

// Unified pool standings table.
// rows: [{id?, name, pts, w?, d?, l?, gf?, ga?, club_logo_url?}]  (normalized format)
// club: string for club-row highlighting
// compact: show only #/Team/Pt without column headers (PinnedPoolSlot)
// large:   wider padding + larger font for use inside modal
// showGoals: add GV-GT column (modal variant)
// showLogos: toon clublogo voor teamnaam indien beschikbaar (default aan)
export function PoolTable({ rows, club, compact = false, large = false, showGoals = false, showLogos = true }) {
  const isMyClub = name => club && name.toLowerCase().startsWith(club.toLowerCase())

  const pad  = large ? { l: '6px 3px 6px 12px', m: '6px 3px', cell: '6px', right: '6px 12px 6px 3px' }
                     : { l: '5px 3px 5px 10px',  m: '5px 3px', cell: '5px 6px', right: '5px 10px 5px 3px' }
  const fs   = large ? 13 : 12
  const hfs  = large ? 10 : 10
  const hpad = large ? { l: '5px 3px 5px 12px', m: '5px 3px', cell: '5px 6px', right: '5px 12px 5px 3px' }
                     : { l: '4px 3px 4px 10px',  m: '4px 3px', cell: '4px 6px', right: '4px 10px 4px 3px' }

  if (compact) {
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <tbody>
          {rows.map((r, i) => {
            const my = isMyClub(r.name)
            return (
              <tr key={r.id ?? i} style={{
                borderTop: `1px solid ${C.border}`,
                background: my ? 'rgba(207,159,63,0.13)' : i === 0 ? 'rgba(207,159,63,0.05)' : 'transparent',
              }}>
                <td style={{ padding: '4px 3px 4px 8px', color: C.muted, fontSize: 10, width: 16 }}>{i + 1}</td>
                <td style={{ padding: '4px 3px', color: my ? C.goldBr : C.chalk,
                  fontWeight: my || i === 0 ? 600 : 400,
                  maxWidth: 0, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <TeamName name={r.name} logoUrl={r.club_logo_url} showLogos={showLogos} highlighted={my} />
                </td>
                <td style={{ padding: '4px 8px 4px 3px', textAlign: 'center',
                  color: C.goldBr, fontWeight: 700, fontSize: 12, width: 26 }}>{r.pts}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fs }}>
      <thead>
        <tr style={{ color: C.muted, fontSize: hfs }}>
          <th style={{ padding: hpad.l, textAlign: 'left', fontWeight: 500, width: large ? 20 : 18 }}>#</th>
          <th style={{ padding: hpad.m, textAlign: 'left', fontWeight: 500 }}>Team</th>
          <th style={{ padding: hpad.cell, textAlign: 'center', fontWeight: 500, width: large ? 26 : 24 }}>W</th>
          <th style={{ padding: hpad.cell, textAlign: 'center', fontWeight: 500, width: large ? 26 : 24 }}>G</th>
          <th style={{ padding: hpad.cell, textAlign: 'center', fontWeight: 500, width: large ? 26 : 24 }}>V</th>
          {showGoals && (
            <th style={{ padding: hpad.cell, textAlign: 'center', fontWeight: 500, width: 44, whiteSpace: 'nowrap' }}>GV–GT</th>
          )}
          <th style={{ padding: hpad.right, textAlign: 'center', fontWeight: 600,
            width: large ? 32 : 30, color: C.chalk }}>Pt</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const my = isMyClub(r.name)
          return (
            <tr key={r.id ?? i} style={{
              borderTop: `1px solid ${C.border}`,
              background: my ? 'rgba(207,159,63,0.13)' : i === 0 ? 'rgba(207,159,63,0.07)' : 'transparent',
            }}>
              <td style={{ padding: pad.l, color: C.muted, fontSize: large ? 11 : 11 }}>{i + 1}</td>
              <td style={{ padding: pad.m, color: my ? C.goldBr : C.chalk,
                fontWeight: my || i === 0 ? 600 : 400,
                maxWidth: 0, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <TeamName name={r.name} logoUrl={r.club_logo_url} showLogos={showLogos} highlighted={my} />
              </td>
              <td style={{ padding: pad.cell, textAlign: 'center', color: C.muted }}>{r.w}</td>
              <td style={{ padding: pad.cell, textAlign: 'center', color: C.muted }}>{r.d}</td>
              <td style={{ padding: pad.cell, textAlign: 'center', color: C.muted }}>{r.l}</td>
              {showGoals && (
                <td style={{ padding: pad.cell, textAlign: 'center', color: C.muted, fontSize: 11 }}>
                  {r.gf ?? 0}–{r.ga ?? 0}
                </td>
              )}
              <td style={{ padding: pad.right, textAlign: 'center',
                color: C.goldBr, fontWeight: 700, fontSize: large ? 14 : 13 }}>{r.pts}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
