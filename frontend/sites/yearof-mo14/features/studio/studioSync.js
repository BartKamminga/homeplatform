// Koppeling preview <-> bewerkpaneel in de beheerstudio (item 1239).
// view  = de pagina in de preview ({ name, ref?, id? }, zie PublicSite)
// panel = het bewerkscherm rechts ({ section, matchRef?, playerId?, reportId? })

// Zelfde volgorde als het menu van de site; daarna wat geen eigen pagina heeft.
export const SECTIONS = [
  { key: 'home', label: 'Home' },
  { key: 'actie', label: 'Actie' },
  { key: 'kijker', label: 'In de kijker' },
  { key: 'spelers', label: 'Team' },
  { key: 'wedstrijden', label: 'Wedstrijden' },
  { key: 'competitie', label: 'Competitie' },
  { key: 'topklasse', label: 'Topklasse' },
  { key: 'fotos', label: "Foto's" },
  { key: 'parijs', label: 'Parijs weekend' },
  { key: 'verslagen', label: 'Algemene berichten', extra: true },
  { key: 'toegang', label: 'Linkjes', extra: true },
]

// Welke pagina in de preview hoort bij welk bewerkscherm.
export function panelForView(view) {
  switch (view.name) {
    case 'home': return { section: 'home' }
    case 'action': return { section: 'actie' }
    case 'spotlight': return { section: 'kijker' }
    case 'team': return { section: 'spelers' }
    case 'player': return { section: 'spelers', playerId: view.id }
    case 'timeline': return { section: 'wedstrijden' }
    case 'entry': return { section: 'wedstrijden', matchRef: view.ref }
    case 'competition': return { section: 'competitie' }
    case 'topklasse': return { section: 'topklasse' }
    case 'upload': return { section: 'fotos' }
    case 'pinksterweekend': return { section: 'parijs' }
    default: return null
  }
}

// Andersom: een tab rechts kiezen laat de preview de bijbehorende pagina tonen.
// null = preview blijft waar hij is (bv. Linkjes heeft geen eigen pagina).
export function viewForSection(section) {
  switch (section) {
    case 'home': return { name: 'home' }
    case 'competitie': return { name: 'competition' }
    case 'topklasse': return { name: 'topklasse' }
    case 'wedstrijden': return { name: 'timeline' }
    case 'spelers': return { name: 'team' }
    case 'fotos': return { name: 'upload' }
    case 'kijker':
    case 'verslagen': return { name: 'spotlight' }
    case 'parijs': return { name: 'pinksterweekend' }
    case 'actie':
    case 'sponsors': return { name: 'action' }
    default: return null
  }
}
