import React from 'react'
import Popup from '../common/Popup'

const HELP = {
  sim: {
    title: '❓ Hoe werkt het?',
    content: (
      <div>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Stand & wedstrijden</p>
        <p>Elke poule-card toont de huidige stand, gespeelde wedstrijden en resterende wedstrijden. Gebruik ⚙️ om gespeelde wedstrijden te tonen/verbergen.</p>

        <p style={{ fontWeight: 600, marginTop: 16, marginBottom: 8 }}>Uitslagen voorspellen</p>
        <ul>
          <li>Klik op een <strong>teamnaam</strong> → dat team wint</li>
          <li>Klik op <strong>vs</strong> → gelijkspel (alleen poule-wedstrijden)</li>
          <li>Klik nogmaals → reset die wedstrijd</li>
        </ul>

        <p style={{ fontWeight: 600, marginTop: 16, marginBottom: 8 }}>Snelknoppen</p>
        <ul>
          <li><strong>✦</strong> = automatische voorspelling (Monte Carlo)</li>
          <li><strong>?</strong> = reset ronde of sectie</li>
          <li>✦ bovenaan een card = voorspel alle wedstrijden in die poule</li>
          <li>✦ naast een sectie-titel = voorspel de hele fase</li>
        </ul>

        <p style={{ fontWeight: 600, marginTop: 16, marginBottom: 8 }}>NK fases</p>
        <ul>
          <li>NK Poulefase / Kwartfinales zijn altijd zichtbaar</li>
          <li>Halve finales verschijnen zodra de vorige fase is ingevuld</li>
          <li>Finale verschijnt zodra de halve finales zijn ingevuld</li>
        </ul>

        <p className="help-tip">💡 De NK-kansen updaten automatisch. Alle ingevulde resultaten worden meegenomen in de simulatie.</p>
      </div>
    )
  },
  settings: {
    title: '⚙️ Instellingen',
    content: (
      <div>
        <p>Pas de website aan naar jouw voorkeuren.</p>
        <ul>
          <li><strong>Thema</strong> — kies tussen Licht, Donker of Victoria (zwart/geel/rood)</li>
          <li><strong>🔥 Vorm-badges</strong> — gekleurde cirkel met punten uit de laatste 5 wedstrijden</li>
          <li><strong>🎮 Gespeeld</strong> — toon W-G-V record en gespeelde wedstrijden in de cards</li>
          <li><strong>🎲 Simulaties</strong> — aantal Monte Carlo simulaties (meer = nauwkeuriger)</li>
          <li><strong>🏑 Focus mode</strong> — toon alleen de poule van jouw club</li>
          <li><strong>Club</strong> — kies jouw club voor highlighting en focus mode</li>
        </ul>
        <p className="help-tip">💡 Alle instellingen worden automatisch opgeslagen.</p>
      </div>
    )
  }
}

export default function HelpPopup({ tab, onClose }) {
  if (tab === 'all') {
    return (
      <Popup title="❓ Uitleg" onClose={onClose} maxWidth={520}>
        <div className="help-content">
          {Object.entries(HELP).map(([key, help]) => (
            <div key={key} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{help.title}</div>
              {help.content}
            </div>
          ))}
        </div>
      </Popup>
    )
  }
  const help = HELP[tab] || HELP.sim
  return (
    <Popup title={help.title} onClose={onClose} maxWidth={520}>
      <div className="help-content">
        {help.content}
      </div>
    </Popup>
  )
}
