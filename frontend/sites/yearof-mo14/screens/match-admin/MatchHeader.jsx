import { useState } from 'react'
import LinkPanel, { CreateShortLinkButton } from '../LinkPanel.jsx'
import InviteCreateForm from '../InviteCreateForm.jsx'
import MatchLookSettings from './MatchLookSettings.jsx'

// Kop van de wedstrijdbeheerpagina, zelfde opbouw als de andere pagina's:
// groene balk met de wedstrijd, daaronder ingeklapt de instellingen met de
// kopstijl/clubkleuren, wedstrijdlinks en invullinks.
export default function MatchHeader({ item, matchRef, players }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 12px', marginBottom: 14,
        borderRadius: 10, fontSize: 12, background: '#dcfce7', color: '#12203c',
      }}>
        <strong style={{ flex: 1 }}>Wedstrijd {item.title}</strong>
        <span style={{ color: '#4b5563' }}>{item.date?.slice(0, 10)} &middot; {item.kind}</span>
      </div>

      <div className="yof-card" style={{ marginBottom: 16, padding: open ? 14 : '8px 14px' }}>
        <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 700, width: '100%', textAlign: 'left' }}>
          {open ? '▾' : '▸'} Wedstrijd-instellingen
          <span style={{ fontWeight: 400, color: '#888' }}>&nbsp;&middot; kopstijl, clubkleuren, wedstrijdlinks en invullinks</span>
        </button>
        {open && (
          <div style={{ marginTop: 12 }}>
            <MatchLookSettings item={item} />
            <LinkPanel kinds={['match', 'contribute']} filter={l => l.match_ref === matchRef} actions={{
              // Wedstrijdlink voor de Vrienden-van-groep (item 1186): eigen token, 10 dagen
              // geldig. Kopieer/Bekijk/Intrekken staan in de rij van de link.
              match: (rows, reload) => (
                <CreateShortLinkButton rows={rows} body={{ match_ref: matchRef }} label="Maak wedstrijdlink" onCreated={reload} />
              ),
              contribute: (_, reload) => <InviteCreateForm matchRef={matchRef} players={players} onCreated={reload} />,
            }} />
          </div>
        )}
      </div>
    </>
  )
}
