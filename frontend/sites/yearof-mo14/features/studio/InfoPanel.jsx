// Uitlegpaneel voor pagina's zonder eigen bewerkscherm (item 1239): welke
// blokken staan er, en waar bewerk je ze.
const PAGES = {
  home: {
    title: 'Home',
    intro: 'Home heeft geen eigen bewerkscherm - de blokken komen van elders:',
    blocks: [
      { label: 'Thermometer van de actie', section: 'actie' },
      { label: 'Laatste / volgende wedstrijd en pouletabel', note: 'automatisch uit de hockeydata' },
      { label: 'Speelster van de week', section: 'spelers' },
      { label: 'Volgende week in de kijker', section: 'wedstrijden', note: 'via de invullinks van de volgende wedstrijd' },
      { label: 'In de kijker (nieuwste 2)', section: 'kijker' },
    ],
  },
  competitie: {
    title: 'Competitie en Topklasse',
    intro: 'Deze tabs komen volledig uit de hockeydata en hebben niets om te bewerken.',
    blocks: [
      { label: 'Zichtbaar voor bezoekers', note: 'aan/uit via de gele balk bovenaan de pagina in de preview' },
    ],
  },
}

const SECTION_LABELS = {
  actie: 'Actie', spelers: 'Spelers', wedstrijden: 'Wedstrijden', kijker: 'In de kijker',
}

export default function InfoPanel({ section, onSelectSection }) {
  const page = PAGES[section]
  if (!page) return null
  return (
    <div>
      <h3 style={{ fontSize: 16, margin: '0 0 6px' }}>{page.title}</h3>
      <p style={{ fontSize: 13, color: '#666', margin: '0 0 12px' }}>{page.intro}</p>
      {page.blocks.map(b => (
        <div key={b.label} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          padding: '10px 12px', border: '1px solid #eee', borderRadius: 10, marginBottom: 6, fontSize: 13,
        }}>
          <div>
            <strong>{b.label}</strong>
            {b.note && <div style={{ fontSize: 12, color: '#888' }}>{b.note}</div>}
          </div>
          {b.section && onSelectSection && (
            <button className="yof-btn-secondary" onClick={() => onSelectSection(b.section)}>
              Bewerk in {SECTION_LABELS[b.section]} &rarr;
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
