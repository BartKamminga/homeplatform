// Filters voor het Berichten-overzicht (item 1249) - pure functies, zoals
// photoFilters. ctx = { pageLabel(ref) }

export const STATUS_FILTERS = [
  { key: '', label: 'Alle' },
  { key: 'published', label: 'Live' },
  { key: 'concept', label: 'Concept' },
]

export const TYPE_LABEL = {
  wedstrijdverslag: 'Verslag', interview: 'Interview', nieuws: 'Bericht',
  instagram: 'Instagram', wedstrijd_beelden: 'Wedstrijdbeelden',
}

// Pagina-filter: '' = alles, 'matches' = alle wedstrijden, anders een match_ref ("page:<id>")
export function matchesFilters(r, f, ctx) {
  if (f.status && r.status !== f.status) return false
  if (f.page === 'matches' && r.match_ref?.startsWith('page:')) return false
  if (f.page && f.page !== 'matches' && r.match_ref !== f.page) return false
  if (f.type && r.report_type !== f.type) return false
  if (f.home && !r.featured) return false
  if (f.search) {
    const q = f.search.toLowerCase()
    const hay = `${r.title} ${r.body} ${r.author_name || ''} ${ctx.pageLabel(r.match_ref)}`.toLowerCase()
    if (!hay.includes(q)) return false
  }
  return true
}

export const newestFirst = (a, b) => (b.created_at || '').localeCompare(a.created_at || '')
