// Gedeelde onderdelen voor uitslagen/programma (PouleResults, RoundRolodex).

export const fmtRoundDate = iso => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

function Logo({ src }) {
  return src
    ? <img src={src} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <span style={{ width: 18, flexShrink: 0 }} />
}

// 1 wedstrijd: thuis - score/vs - uit, eigen team uitgelicht.
export default function MatchRow({ m, teamName }) {
  const ours = m.home === teamName || m.away === teamName
  const played = m.home_score != null && m.away_score != null
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, padding: '6px 8px',
      fontSize: 12, borderRadius: 8, background: ours ? '#fdf8e8' : 'transparent', fontWeight: ours ? 700 : 400,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', textAlign: 'right' }}>
        {m.home.replace(' MO14-1', '')} <Logo src={m.home_club_logo} />
      </span>
      <span style={{ minWidth: 44, textAlign: 'center', fontWeight: 800, color: played ? '#12203c' : '#999' }}>
        {played ? `${m.home_score} - ${m.away_score}` : 'vs'}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Logo src={m.away_club_logo} /> {m.away.replace(' MO14-1', '')}
      </span>
    </div>
  )
}
