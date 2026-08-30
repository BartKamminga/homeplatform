import { useCollapse } from '../ui.jsx'

// Uitleg-paneel "hoe werkt dit" (Bart, 30-08-2026: "de regels van de queue
// moeten we duidelijker maken aan de gebruiker") - in gewone taal welke
// regels de cmd-queue automatisch vullen, los van de losse Debug-tab die
// de rauwe data toont. Reasons hier moeten in lijn blijven met
// _matchday_due_reason/_step_*/hockey_vanger_schedule.py.
const RULES = [
  { reason: 'match_start_check', text: '15 min na de voorspelde start van een wedstrijd, 1x, om te zien of hij live staat.' },
  { reason: 'match_end_check', text: 'Op het voorspelde einde van een wedstrijd, 1x. Geen resultaat? Dan volgt dynamisch een retry_match_end een paar minuten later - net zolang tot de uitslag bekend is of de uiterste stoptijd verstrijkt.' },
  { reason: 'retry_match_end', text: 'Dynamische vervolgcheck ná een match_end_check zonder resultaat - verschijnt pas als de vorige check niets opleverde, niet vooraf gepland.' },
  { reason: 'match_live', text: 'Dynamisch, periodiek checken zolang een wedstrijd bevestigd live staat (ontdekt via match_start_check) - stopt zodra de uitslag bekend is.' },
  { reason: 'daily_fallback', text: '1x per dag voor poules zonder wedstrijd vandaag - vangnet voor latere correcties. Slaat over als de eerstvolgende wedstrijd nog ver weg is, of als het seizoen voor die poule voorbij is.' },
  { reason: 'unknown_start_recheck', text: 'Vaker gecheckt dan de dagelijkse fallback voor een wedstrijd waarvan de datum al bekend is, maar de starttijd nog niet.' },
  { reason: 'manual_weekly', text: '1x per week voor competities die niet automatisch rond wedstrijddagen gevolgd worden (scan_profile "handmatig").' },
  { reason: 'club_scan / clublijst', text: 'Periodiek, maar nooit in het weekend - die ruimte is dan voor matchday-scans.' },
  { reason: 'new_or_empty', text: 'Meteen zodra een nieuw team of een nog lege poule wordt ontdekt.' },
]

export default function QueueRulesInfo() {
  const [open, toggle] = useCollapse(false)
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
      <div
        onClick={toggle}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 12 }}>{open ? '▾' : '▸'}</span>
        <span style={{ fontWeight: 600, fontSize: 13 }}>❔ Hoe werkt de queue?</span>
      </div>
      {open && (
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11, color: 'var(--color-text-muted)' }}>
          <div>
            Zolang <strong>Scan-plan actief</strong> aan staat, vult het systeem de queue vanzelf volgens deze regels:
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {RULES.map(r => (
              <li key={r.reason}>
                <code style={{ fontSize: 10, background: 'var(--color-bg)', padding: '1px 4px', borderRadius: 3 }}>{r.reason}</code>
                {' '}— {r.text}
              </li>
            ))}
          </ul>
          <div style={{ paddingTop: 4, borderTop: '1px solid var(--color-border)' }}>
            Precieze tijdstippen instellen kan bij <strong>⚙ Instellingen</strong> hierboven. Alle geplande momenten
            (ook toekomstige) zijn te bekijken in de Debug-tab onder <strong>Scanschema</strong>.
          </div>
          <div>
            Het <strong>filter</strong> hieronder (leeftijd/geslacht/hockeytype) bepaalt echt wat Ghost/Scout uit de
            queue oppakt — een cmd die buiten het filter valt, blijft onopgemerkt liggen tot het filter verandert.
          </div>
        </div>
      )}
    </div>
  )
}
