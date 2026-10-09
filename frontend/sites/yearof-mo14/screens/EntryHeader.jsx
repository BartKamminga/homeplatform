import FormattedText from './FormattedText.jsx'
import MatchCard from '../features/matches/MatchCard.jsx'
import { toCardModel, matchStyle } from '../features/matches/matchCardModel.js'
import usePageBlocks from '../features/blocks/usePageBlocks.js'

// Kop van een wedstrijd/bijzondere dag: soort, logo's, titel, datum, locatie,
// uitslag en beschrijving. Uit PublicEntry gehaald (item 1239).
export default function EntryHeader({ item }) {
  const { setting } = usePageBlocks()
  const model = toCardModel(item)
  if (model) {
    // Competitiewedstrijd: kaart A/B/C - per wedstrijd in te stellen, anders de standaard van de pagina Wedstrijden
    const variant = matchStyle(setting, item.match_ref, 'header')
    return (
      <>
        <MatchCard model={model} variant={variant} />
        {item.description && (
          <div className="yof-card" style={{ marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-line' }}><FormattedText text={item.description} /></p>
          </div>
        )}
      </>
    )
  }
  return (
    <div className="yof-card" style={{ marginBottom: 14 }}>
      <span className={`badge ${item.kind}`}>{item.kind}</span>
      {(item.home_club_logo || item.away_club_logo) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '10px 0 2px' }}>
          {item.home_club_logo
            ? <img src={item.home_club_logo} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
            : <div style={{ width: 36, height: 36 }} />}
          <span style={{ fontSize: 12, color: '#999' }}>vs</span>
          {item.away_club_logo
            ? <img src={item.away_club_logo} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
            : <div style={{ width: 36, height: 36 }} />}
        </div>
      )}
      <h2 style={{ margin: '10px 0 4px', fontSize: 18 }}>{item.title}</h2>
      <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
        {new Date(item.date).toLocaleDateString('nl-NL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        {(() => {
          const d = new Date(item.date)
          const hasTime = !(d.getHours() === 0 && d.getMinutes() === 0) // 00:00 = tijd onbekend
          return hasTime ? ` · ${d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}` : ''
        })()}
      </p>
      {item.location && (
        <p style={{ margin: '4px 0 0', fontSize: 13 }}>
          📍 <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`}
            target="_blank" rel="noreferrer" style={{ color: '#12203c' }}>{item.location}</a>
        </p>
      )}
      {(item.score_home ?? item.score_us) != null && (
        <p style={{ fontSize: 24, fontWeight: 800, margin: '14px 0 0' }}>
          {item.score_home ?? item.score_us} - {item.score_away ?? item.score_them}
        </p>
      )}
      {item.description && <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-line' }}><FormattedText text={item.description} /></p>}
    </div>
  )
}
