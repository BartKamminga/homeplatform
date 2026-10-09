import usePageBlocks from '../blocks/usePageBlocks.js'
import { SPOTLIGHT_PAGE } from './useCustomPages.js'

// Naam, icoon, titel en ondertitel per vaste pagina (item 1248): standaard
// hieronder, aanpasbaar in het bewerkscherm; opgeslagen als blokinstelling
// "page.<view>" (eigen pagina's hebben dit in custom-pages).
export const FIXED_PAGES = {
  home: { label: 'Home', icon: '🗼', title: 'Samen op naar Parijs!', subtitle: 'Volg het team, bekijk de wedstrijden en steun de actie voor onze teamtrip.' },
  action: { label: 'Actie', icon: 'hand-coins', title: 'De actie', subtitle: '' },
  spotlight: { label: SPOTLIGHT_PAGE.label, icon: 'star', title: SPOTLIGHT_PAGE.title, subtitle: SPOTLIGHT_PAGE.subtitle },
  team: { label: 'Team', icon: 'users', title: 'Het team', subtitle: '' },
  timeline: { label: 'Wedstrijden', icon: 'calendar-days', title: 'Wedstrijden & bijzondere dagen', subtitle: '' },
  competition: { label: 'Competitie', icon: 'list-ordered', title: 'Competitie', subtitle: '' },
  topklasse: { label: 'Topklasse', icon: 'trophy', title: 'Topklasse MO14 landelijk', subtitle: '' },
  upload: { label: "Foto's toevoegen", icon: 'camera', title: "Foto's & filmpjes toevoegen", subtitle: '' },
}

// Studio-sectie -> view-naam van de vaste pagina
export const SECTION_VIEW = {
  home: 'home', actie: 'action', kijker: 'spotlight', spelers: 'team', wedstrijden: 'timeline',
  competitie: 'competition', topklasse: 'topklasse', upload: 'upload',
}

export const pageMetaId = view => `page.${view}`

// Alle vaste pagina's met eventuele aanpassingen: meta(view) -> { label, icon, title, subtitle }
export default function usePageMeta() {
  const { settings } = usePageBlocks()
  return view => {
    const saved = settings[pageMetaId(view)] || {}
    const base = FIXED_PAGES[view] || {}
    const pick = key => (saved[key] !== undefined && saved[key] !== '' ? saved[key] : base[key]) || ''
    return { label: pick('label'), icon: pick('icon'), title: pick('title'), subtitle: pick('subtitle') }
  }
}
