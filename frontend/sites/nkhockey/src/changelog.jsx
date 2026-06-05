import React from 'react'

export const VERSION = '6.2'
export const CHANGELOG = [
  { version: '6.2', date: '5 jun 2026', changes: [
    'Simulaties is nu een pure schakelaar — zet voorspelknoppen en wedstrijd-klikken aan',
    'Simulaties toont alleen NK Kansen + herbereken knop',
    'Poules en NK Fase zijn onafhankelijke filters — geen overlap meer',
    'Combinatie Poules + Simulaties: poule cards met interactie + NK Kansen',
    'Combinatie NK Fase + Simulaties: NK fase met interactie + NK Kansen',
    'Niets geselecteerd: alles zichtbaar, niet interactief',
    'O16 NK Fase toont geen sub-knoppen meer — altijd KF/HF/Finale in één klik',
  ]},
  { version: '6.1', date: '5 jun 2026', changes: [
    '🧭 Nieuwe NavFilter navigatie — drie scrollbare rijen: competitie, fase en poule',
    'Multi-select filter: meerdere poules en NK fases tegelijk selecteren',
    'Focus mode past NavFilter automatisch aan op eigen poule en NK fase',
    'O14: focus mode selecteert automatisch NK Poule A of B op basis van verwachte stand',
    'O16: focus mode selecteert automatisch KF als team in top 2 staat',
    'Thema switch verplaatst naar ⚙️ instellingen — platform-breed via ThemeSwitcher',
    '4 platform thema\'s: ☀️ Licht, 🌙 Donker, ◻ Minimal, 📻 Retro',
    'NavFilterDefault beschikbaar als fallback (USE_NEW_NAV toggle in App.jsx)',
  ]},
  { version: '6.0', date: '31 mei 2026', changes: [
    '🎉 Grote update: alles op één pagina — geen tabs meer',
    'Poule-cards tonen stand + gespeelde wedstrijden + resterende wedstrijden in één card',
    'Gespeelde wedstrijden zichtbaar via ⚙️ → 🎮 Gespeeld toggle',
    'Overzicht en Speelschema tab verwijderd — SimPouleCard is nu de universele card',
    'NK fases (Poulefase, HF, Finale) direct zichtbaar onder de poule-cards',
    'Uitleg popup aangepast voor de nieuwe indeling',
  ]},
  { version: '5.25', date: '21 mei 2026', changes: [
    'Grote refactor: App.jsx van 206 naar 125 regels',
    'SettingsPopup, MenuPopup, EasterEgg als eigen componenten',
    '29 hardcoded kleuren → CSS variables (dark mode proof)',
    'Toggle, NKChances, SchemaTab, HelpPopup: alle kleuren via thema',
  ]},
  { version: '5.24', date: '21 mei 2026', changes: [
    '❓ Uitleg popup — tab-aware instructies voor Overzicht, Speelschema en Simulaties',
    'Bereikbaar via menu → ❓ Uitleg knop',
    'Toont uitleg specifiek voor de actieve tab',
    'Tips over focus mode, snelknoppen en NK fases',
  ]},
  { version: '5.23', date: '21 mei 2026', changes: [
    'Victoria club thema: zwart/geel/rood kleurenschema',
    'Thema-keuze in settings: ☀️ Licht, 🌙 Donker, Victoria (met logo)',
    'Victoria logo in header wanneer Victoria thema actief',
    'Thema opgeslagen in localStorage (nk_theme)',
  ]},
  { version: '5.22', date: '21 mei 2026', changes: [
    '🌙 Dark mode — volledig donker thema met CSS variables',
    'Toggle in ⚙️ instellingen, opgeslagen in localStorage',
    'Respecteert systeem-voorkeur (prefers-color-scheme) bij eerste bezoek',
    'Alle CSS kleuren via variabelen: 40+ kleuren, licht en donker',
    'Popups, changelog, disclaimer aangepast voor dark mode',
  ]},
  { version: '5.21', date: '21 mei 2026', changes: [
    'CSS opgeschoond: 16 ongebruikte classes verwijderd (import-screen, sub-tabs, sim-table, etc.)',
    'Stylesheet geformateerd en logisch gegroepeerd (Reset, Top bar, Cards, Match rows, etc.)',
    'Van 118 regels compacte CSS naar 210 regels leesbare CSS',
  ]},
  { version: '5.20', date: '21 mei 2026', changes: [
    'Grote refactor: App.jsx van 220 naar 118 regels',
    'Herbruikbare componenten: Popup, Toggle, FormBadge in common/',
    'DisclaimerPopup en FeedbackPopup als eigen componenten in popups/',
    'FormBadge deduplicatie: één bron in common/ i.p.v. kopieën in PouleCard + SimPouleCard',
    'Settings popup gebruikt Toggle component',
  ]},
  { version: '5.19', date: '21 mei 2026', changes: [
    '💬 Feedback popup: emoji-rating + tekstveld',
    '"Backhand in de kruising 🏑" knop opent een GitHub Issue',
    'Bereikbaar via versie-tab → 💬 Feedback knop',
  ]},
  { version: '5.18', date: '21 mei 2026', changes: [
    'ℹ️ Over deze website — disclaimer popup bij eerste bezoek',
    'Verschijnt één keer, daarna opvraagbaar via versie-tab',
    'Informatieve notice: hobbyproject, data van hockey.nl, geen officieel akkoord KNHB',
    'Simulaties en voorspellingen zijn indicatief',
  ]},
  { version: '5.17', date: '21 mei 2026', changes: [
    'Alle instellingen in één ⚙️ popup: club, focus mode, vorm-badges, gespeeld',
    'Club picker verplaatst naar settings popup met scrollbare lijst',
    'Focus mode toggle verplaatst van 🏑 icoon naar settings popup',
    'Aparte club picker popup verwijderd',
    'Klik op 🏑 of clubnaam in header opent nu de settings popup',
  ]},
  { version: '5.16', date: '21 mei 2026', changes: [
    '⚙️ Instellingen popup in header met toggles',
    '🔥 Vorm-badges: toon/verberg gekleurde cirkel met puntentotaal laatste 5',
    '🎮 Gespeeld aantal: toon/verberg W-G-V record per team',
    'Beide instellingen opgeslagen via localStorage',
    'SimTab: W-G-V berekend inclusief voorspelde wedstrijden',
    'iOS-style toggle switches in de popup',
  ]},
  { version: '5.15', date: '21 mei 2026', changes: [
    '📊 toggle in header: toon/verberg vorm-badges globaal',
    'Instelling wordt opgeslagen via localStorage (persistent over sessies)',
    'Blauwe rand op 📊 knop wanneer actief',
    'Werkt op alle tabs: Overzicht en Simulaties',
  ]},
  { version: '5.14', date: '21 mei 2026', changes: [
    'Score-voorspelling: ✦ genereert realistische scores (bijv. 3-1, 0-0, 2-4)',
    'Scores zichtbaar in de wedstrijd-cards (i.p.v. alleen groene highlight)',
    'Doelsaldo in de stand berekend uit ingevulde scores',
    'Handmatig klikken (W/G/V) genereert ook automatisch een passende score',
    'Backward compatible: oude string locks ("W") worden nog steeds ondersteund',
  ]},
  { version: '5.13', date: '21 mei 2026', changes: [
    'Vorm-indicator: laatste 5 wedstrijden als gekleurde bolletjes (groen/geel/rood)',
    'Zichtbaar in Overzicht (PouleCard) en Simulaties (SimPouleCard)',
    'Achter het doelsaldo per team',
  ]},
  { version: '5.12', date: '21 mei 2026', changes: [
    'Refactor: simulation.js — shared resolveMatch helper, simPoulePhase deduplicatie',
    'Refactor: inline ronde-header styles → CSS classes (round-header-played, round-header-remaining)',
    'Refactor: ChangelogContent verplaatst naar changelog.jsx',
    'simulation.js van 204 naar 179 regels',
  ]},
  { version: '5.11', date: '21 mei 2026', changes: [
    'Grote refactor: SimTab.jsx (830 regels) opgesplitst in 8 bestanden',
    'SimPouleCard, SectionLabel, NKChances, RemainingPouleCards, O14NKPhase, O16KFPhase als eigen componenten',
    'helpers.js voor gedeelde functies (getExpectedStandings, buildAllSimLocks)',
    'Changelog verplaatst naar apart bestand (changelog.js)',
    'constants.js teruggebracht van 250 naar 22 regels',
    'Geen bestand boven 150 regels — alles logisch gegroepeerd',
  ]},
  { version: '5.10', date: '21 mei 2026', changes: [
    '✦ en ? knoppen op sectie-niveau: voorspel/reset een hele fase in één klik',
    'Resterende wedstrijden: ✦ voorspelt alle poule-wedstrijden, ? reset',
    'NK Poulefase: ✦ voorspelt Poule A + B samen, ? reset',
    'NK Kwartfinales / Halve Finales / Finale: elk met eigen ✦ en ?',
    'Herbruikbaar SectionLabel component voor consistente sectie-headers',
  ]},
  { version: '5.9.4', date: '21 mei 2026', changes: [
    'KO-fases (KF/HF/Finale/3e4e): geen stand-tabel meer — alleen wedstrijden',
    'KO-fases: ✦ voorspelling geeft altijd een winnaar (nooit gelijkspel)',
    'KO-fases: klik op team = die wint, klik vs = reset, geen gelijkspel optie',
    'SimPouleCard: hideStandings prop voor KO-cards',
  ]},
  { version: '5.9.3', date: '21 mei 2026', changes: [
    'KO-wedstrijden: geen gelijkspel-klik meer in de interface',
  ]},
  { version: '5.9.2', date: '21 mei 2026', changes: [
    'Eindkansen tabellen verwijderd (alle teams overzicht)',
  ]},
  { version: '5.9.1', date: '21 mei 2026', changes: [
    'Eindkansen section label verwijderd',
  ]},
  { version: '5.9', date: '21 mei 2026', changes: [
    'Eindkansen verwerken nu alle ingevulde resultaten uit alle fases',
    'O14: NK Poulefase locks, HF locks en Finale locks meegerekend in Monte Carlo',
    'O16: KF locks, HF locks en Finale locks meegerekend in Monte Carlo',
    'Vastgezette NK-wedstrijden worden niet meer random gesimuleerd',
    'Simulatie-engine uitgebreid: simNKPoule accepteert locks, simKOWithLock voor KO-rondes',
  ]},
  { version: '5.8', date: '21 mei 2026', changes: [
    'NK Halve Finales en Finale cards in Simulatie tab',
    'O14: HF verschijnt zodra beide NK Poulefases volledig zijn ingevuld',
    'O14: Finale + 3e/4e plaats verschijnt zodra HF is ingevuld',
    'O16: HF verschijnt zodra alle 4 KF-winnaars bekend zijn',
    'O16: Finale verschijnt zodra HF-winnaars bekend zijn',
    'Alle cards gebruiken SimPouleCard met klik-interface',
  ]},
  { version: '5.7', date: '21 mei 2026', changes: [
    'Sub-tabs Super-poules/NK Poulefase/Poules verwijderd — alleen Eindkansen blijft',
    'O16 Kwartfinales gebruikt nu SimPouleCard (zelfde interface als poule-cards)',
    '✦ bovenaan elke SimPouleCard voorspelt alle onvoorspelde wedstrijden',
    'T/G/U ronde-knoppen verwijderd — alleen ✦ en ? per ronde',
    '"nog X rondes" telt alleen onvoorspelde rondes',
    'Herbruikbaar SimPouleCard component voor Super, NK Poulefase én Kwartfinales',
  ]},
  { version: '5.6', date: '20 mei 2026', changes: [
    'NK fase in Simulatie tab: O14 NK Poulefase en O16 Kwartfinales met klikbare wedstrijden',
    'Teams worden ingevuld op basis van huidige stand + vastgezette what-if uitslagen',
    'O14: NK Poule A en B schema met alle 10 wedstrijden per poule, met slot-labels',
    'O16: 4 KF-wedstrijden met verwachte teamindeling',
    'Wijzig poule-uitslagen → NK deelnemers updaten automatisch',
  ]},
  { version: '5.5', date: '20 mei 2026', changes: [
    '✦ Voorspel-knop per ronde: berekent meest waarschijnlijke uitslagen via Monte Carlo',
    'Teamsterkte gebaseerd op huidige punten en doelsaldo',
    '1.000 mini-simulaties per wedstrijd voor de voorspelling',
    'Klikt automatisch W/G/V in op basis van de meest voorkomende uitslag',
  ]},
  { version: '5.4', date: '20 mei 2026', changes: [
    'Simulatie tab: chronologische poule-weergave (gespeelde rondes + resterende rondes)',
    'Gespeelde wedstrijden met uitslagen (zoals Speelschema tab)',
    'Resterende wedstrijden met klik-interface: klik thuisteam/gelijk/uitteam',
    'Geen apart scenario-panel meer — alles in één tijdlijn',
    'Per ronde snelkeuze: T (thuis) / G (gelijk) / U (uit) / ? (reset)',
    'Focus mode niet meer relevant voor Simulatie tab — altijd hele poule',
  ]},
  { version: '5.3', date: '20 mei 2026', changes: [
    'Zonder focus club: alle resterende wedstrijden invulbaar per ronde',
    'Klik op thuisteam = thuis wint (groen), midden = gelijk (geel), uitteam = uit wint (groen)',
    'Per ronde snelkeuze: T (thuis wint) / G (gelijk) / U (uit wint) / ? (reset)',
    'Met focus club: compacte W/G/V knoppen (zoals voorheen)',
    'Poule-stand na scenario toont nu alle gewijzigde poules (niet alleen focus-poule)',
    'Adjusted standings werken correct in beide modes',
  ]},
  { version: '5.2.1', date: '20 mei 2026', changes: [
    'Poule-stand na scenario: toont punten met what-if resultaten verwerkt',
    'Per team: huidige punten + delta + nieuw totaal (bijv. "21 +3 = 24")',
    'Stand wordt automatisch opnieuw gesorteerd op nieuwe punten',
    'Alleen zichtbaar als er scenario\'s zijn ingesteld',
    'Opgeruimd: oude O14SimTab, O16SimTab en WhatIf bestanden verwijderd',
  ]},
  { version: '5.2', date: '20 mei 2026', changes: [
    'Simulaties en What-if samengevoegd in één tab',
    'What-if scenario-panel bovenaan met W/G/V knoppen per wedstrijd',
    'NK kansen focus club direct onder de scenario\'s met verschil t.o.v. baseline',
    'Sim-slider en detail-tabellen (Super-poules / NK Poulefase / Eindkansen) daaronder',
    'What-if tab verwijderd — alles zit nu in Simulaties',
    'What-if herberekent automatisch bij wijzigen scenario; slider alleen via knop',
    'Fix: sliders triggeren niet meer automatisch herberekening',
    'Fix: actieve tab behouden bij wisselen van competitie',
  ]},
  { version: '5.1.1', date: '20 mei 2026', changes: [
    'Fix: announced wedstrijden nu ook meegenomen als resterend (naast scheduled)',
    'Fix: What-if W/G/V nu vanuit perspectief focus club, niet thuisclub',
    'Volledige versiegeschiedenis hersteld',
  ]},
  { version: '5.1', date: '20 mei 2026', changes: [
    'What-if tab: stel resultaten in voor resterende wedstrijden van je club',
    'Klik op een wedstrijd om te wisselen: ? → W → G → V → ?',
    'NK-kansen herberekenen live met vastgezette resultaten',
    'Verschil met baseline getoond (+5%, -3%) per NK-fase',
    'Preset knoppen: Alles winst / Alles gelijk / Alles verlies / Reset',
    'Werkt voor zowel O14 als O16 competities',
  ]},
  { version: '5.0', date: '20 mei 2026', changes: [
    'Migratie naar Vite + React — snellere builds, betere code-structuur',
    'Componenten opgesplitst in aparte bestanden',
    'GitHub Actions: automatische build en deploy bij elke push',
    'Geen Babel-in-browser meer — pre-compiled JavaScript',
    'VS Code ondersteuning: syntax highlighting, IntelliSense, hot-reload',
  ]},
  { version: '4.13', date: '19 mei 2026', changes: [
    'Gekozen competitie wordt onthouden via localStorage',
    'Bij openen van de website wordt de laatst gekozen competitie weer geselecteerd',
  ]},
  { version: '4.12.2', date: '19 mei 2026', changes: [
    'Fix: afgelaste/discontinued wedstrijden worden niet meer getoond bij resterende wedstrijden',
    'Alleen wedstrijden met status "scheduled" tellen als resterend',
  ]},
  { version: '4.12.1', date: '19 mei 2026', changes: [
    'Zoekbalk verwijderd uit club picker popup',
  ]},
  { version: '4.12', date: '19 mei 2026', changes: [
    'Header 2-regelig: bovenaan 🏑 club + knoppen, onderaan competitie-tabs',
    'Stabiele layout — niets verspringt meer',
  ]},
  { version: '4.11', date: '19 mei 2026', changes: [
    'Header layout stabiel: 3 vaste secties (links: club, midden: comp-tabs, rechts: knoppen)',
    'Competitie-knoppen gecentreerd, verspringen niet meer bij focus mode toggle',
  ]},
  { version: '4.10', date: '19 mei 2026', changes: [
    '🏑 Victoria vooraan in de header, competitie-knoppen erna',
  ]},
  { version: '4.9.5', date: '19 mei 2026', changes: [
    'Speelschema: datum achter elke ronde-header (bijv. "Ronde 9 · 30 mei")',
    'Geldt voor zowel gespeelde als resterende wedstrijden',
    'Datum uit de match-data van de API',
  ]},
  { version: '4.9.4', date: '19 mei 2026', changes: [
    'O14: legend "→ NK Poulefase A / B" verwijderd',
  ]},
  { version: '4.9.3', date: '19 mei 2026', changes: [
    'O14 Focus mode: NK Speelschema toont alleen wedstrijden van focus club',
    'Ronde-nummering blijft correct (originele rondenummers behouden)',
  ]},
  { version: '4.9.2', date: '19 mei 2026', changes: [
    'O16: NK Kwartfinales indeling en wedstrijden altijd volledig zichtbaar (ook in focus mode)',
  ]},
  { version: '4.9.1', date: '19 mei 2026', changes: [
    'Focus mode: NK Poulefase toont alleen de poule waar focus club in zit (A of B)',
    'Focus mode: NK Speelschema toont alleen de relevante poule',
    'NK Finales altijd zichtbaar (focus club kan daar terechtkomen)',
  ]},
  { version: '4.9', date: '19 mei 2026', changes: [
    'Focus mode toont NK Poulefase indeling en NK Speelschema met alle data',
    'Alleen poule-kaarten (stand) worden gefilterd op focus club',
    'Grid past zich aan: 1 poule in focus → smalere layout',
  ]},
  { version: '4.8', date: '19 mei 2026', changes: [
    'Focus mode: klik op 🏑 → toont alleen de poule en competities van je focus club',
    'Klik nogmaals op 🏑 → terug naar volledig overzicht',
    'Blauwe rand om 🏑 icoon en "focus" label wanneer actief',
    'Simulaties draaien altijd op alle data (niet gefilterd)',
    'Competitie-tabs worden gefilterd in focus mode',
  ]},
  { version: '4.7', date: '19 mei 2026', changes: [
    'Focus club kiesbaar: klik op clubnaam → popup met alle clubs uit geladen data',
    'Keuze wordt onthouden via localStorage (persistent over sessies)',
    'Default: Victoria',
  ]},
  { version: '4.6', date: '19 mei 2026', changes: [
    'Header vereenvoudigd: alleen competitie-knoppen + 🏑 Victoria',
    'Versiegeschiedenis als popup (klik op versienummer) i.p.v. aparte tab',
    'Popup sluit bij klik buiten het venster',
  ]},
  { version: '4.5', date: '19 mei 2026', changes: [
    'Competitie-knoppen korter: MO14, JO14, MO16, JO16',
    'Tab "Monte Carlo" hernoemd naar "Simulaties"',
    'Tab "Changelog" hernoemd naar "Versiegeschiedenis"',
  ]},
  { version: '4.4', date: '19 mei 2026', changes: [
    '↻ knop herlaadt data van GitHub in plaats van naar import-scherm te gaan',
    'Cache-busting: ?t=timestamp aan data-URLs zodat altijd de nieuwste versie wordt geladen',
    'Behoudt actieve competitie-tab bij herladen',
  ]},
  { version: '4.3', date: '19 mei 2026', changes: [
    'GitHub Pages hosting: data-URLs relatief (werkt op GitHub Pages en lokaal)',
    'Extensie v6 pusht data direct naar GitHub repo',
  ]},
  { version: '4.2', date: '19 mei 2026', changes: [
    'NK speelschema (O14) embedded in HTML — geen aparte bestanden meer nodig',
    'NK Speelschema en Finales werken nu ook bij lokaal testen en handmatige import',
    'Pre-geparsed: 28KB raw → 2.5KB compact per schedule',
  ]},
  { version: '4.1.1', date: '19 mei 2026', changes: [
    'Fix: NK Speelschema en NK Finales worden nu ook bij handmatige import geladen',
  ]},
  { version: '4.1', date: '19 mei 2026', changes: [
    'Import: meerdere bestanden tegelijk uploaden (multi-select of drag & drop)',
    'Bestanden worden automatisch samengevoegd (MO14 + JO14 + MO16 + JO16 in één keer)',
    'Import-scherm toont per bestand status (✅/❌) en welke competities erin zitten',
  ]},
  { version: '4.0', date: '19 mei 2026', changes: [
    'O16 support: Landelijke competitie met 4 poules + KF/HF/Finale simulatie',
    'O16 Monte Carlo: Kwartfinales seeding (Beste #1 vs 4e #2, etc.), HF, Finale',
    'O16 Overzicht: 4 poule-kaarten + NK structuur uitleg',
    'Competitie-tabs: MO14, JO14, MO16, JO16 — alles in één app',
    'Parser voor /competitions/national/ format (O16) + /poules/ format (O14)',
  ]},
  { version: '3.1', date: '19 mei 2026', changes: [
    'NK speelschema dynamisch geladen uit JSON bestanden',
    'MO14 en JO14 met eigen tijden en veldnamen',
    'NK Finales met correcte tijden per competitie',
  ]},
  { version: '3.0', date: '19 mei 2026', changes: [
    'Auto-load data van server (/data/*.json)',
    'Import fallback bij geen server-data',
  ]},
  { version: '2.0', date: '19 mei 2026', changes: [
    'Multi-competitie: MO14 + JO14 in één app',
    'Mijn team sectie in de header',
  ]},
  { version: '1.0', date: '19 mei 2026', changes: [
    'Eerste dynamische versie',
    'Monte Carlo simulatie voor Super-poules en NK Poulefase',
    'Import via JSON plakken of bestand uploaden',
  ]},
]

export function ChangelogContent() {
  return (
    <div style={{ maxWidth: 700 }}>
      {CHANGELOG.map(e => (
        <div key={e.version} className="card" style={{ marginBottom: 12 }}>
          <div className="card-header" style={{ justifyContent: 'space-between' }}>
            <span>v{e.version}</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{e.date}</span>
          </div>
          <div style={{ padding: '10px 14px' }}>
            {e.changes.map((c, i) => (
              <div key={i} style={{ fontSize: 12.5, color: 'var(--text-secondary)', padding: '3px 0', display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--win)', flexShrink: 0 }}>+</span><span>{c}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
