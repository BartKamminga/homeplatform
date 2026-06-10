import React from 'react'
import Popup from '../common/Popup'

export default function DisclaimerPopup({ onClose }) {
  return (
    <Popup title="ℹ️ Over deze website" onClose={onClose} maxWidth={520}>
      <div style={{ padding: '16px 20px', fontSize: 13, lineHeight: 1.7, color: 'var(--text)' }}>
        <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Onafhankelijk hobbyproject</p>
        <p>Deze website is een persoonlijk hobbyproject en is op geen enkele wijze verbonden aan, goedgekeurd door, of geassocieerd met de Koninklijke Nederlandse Hockey Bond (KNHB) of hockey.nl.</p>
        <p style={{ marginTop: 10 }}>De wedstrijddata die op deze website wordt getoond is afkomstig van publiek beschikbare informatie op hockey.nl. Er is op dit moment geen officieel akkoord of licentieovereenkomst met de KNHB voor het gebruik van deze data.</p>
        <p style={{ marginTop: 10 }}>De op deze website getoonde simulaties, voorspellingen en scenario-analyses zijn puur indicatief en gebaseerd op statistische modellen (Monte Carlo simulatie). Aan de uitkomsten kunnen geen rechten worden ontleend.</p>
        <p style={{ marginTop: 10 }}>De maker van deze website aanvaardt geen aansprakelijkheid voor de juistheid, volledigheid of actualiteit van de getoonde informatie. Raadpleeg altijd hockey.nl voor officiële standen en uitslagen.</p>
        <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>Mocht de KNHB bezwaar hebben tegen het gebruik van de data, dan zal de website onmiddellijk worden aangepast of verwijderd.</p>
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button className="run-btn" onClick={onClose} style={{ padding: '8px 24px' }}>Begrepen</button>
        </div>
      </div>
    </Popup>
  )
}
