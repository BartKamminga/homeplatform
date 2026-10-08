// Koppeling preview <-> bewerkpaneel in de beheerstudio (item 1239).
// view  = de pagina in de preview ({ name, ref?, id? }, zie PublicSite)
// panel = het bewerkscherm rechts ({ section, matchRef?, playerId?, reportId? })

export const SECTIONS = [
  { key: 'wedstrijden', label: 'Wedstrijden & bijzondere dagen' },
  { key: 'spelers', label: 'Spelers' },
  { key: 'fotos', label: "Foto's" },
  { key: 'verslagen', label: 'Algemene berichten' },
  { key: 'actie', label: 'Actie' },
  { key: 'sponsors', label: 'Sponsors' },
  { key: 'toegang', label: 'Linkjes' },
]

// Welke pagina in de preview hoort bij welk bewerkscherm.
export function panelForView(view) {
  switch (view.name) {
    case 'home': return { section: 'home' }
    case 'action': return { section: 'actie' }
    case 'spotlight': return { section: 'verslagen' }
    case 'team': return { section: 'spelers' }
    case 'player': return { section: 'spelers', playerId: view.id }
    case 'timeline': return { section: 'wedstrijden' }
    case 'entry': return { section: 'wedstrijden', matchRef: view.ref }
    case 'competition':
    case 'topklasse': return { section: 'competitie' }
    case 'upload': return { section: 'fotos' }
    case 'pinksterweekend': return { section: 'wedstrijden' }
    default: return null
  }
}

// Andersom: een tab rechts kiezen laat de preview de bijbehorende pagina tonen.
// null = preview blijft waar hij is (bv. Linkjes heeft geen eigen pagina).
export function viewForSection(section) {
  switch (section) {
    case 'wedstrijden': return { name: 'timeline' }
    case 'spelers': return { name: 'team' }
    case 'fotos': return { name: 'upload' }
    case 'verslagen': return { name: 'spotlight' }
    case 'actie':
    case 'sponsors': return { name: 'action' }
    default: return null
  }
}
