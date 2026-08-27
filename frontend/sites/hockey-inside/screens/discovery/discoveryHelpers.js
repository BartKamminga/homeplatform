// Zuivere helpers voor Discovery-competities, losgetrokken uit
// DiscoveryCompetities.jsx (item 737 - bestand was >300 regels).

// roadmap-melding: senioren-competities als "Heren O25 NK Zaal" bevatten ook
// een O-getal (reserve/masters-klasse), waardoor de kale /O\d+/-regex ze
// onterecht als Jeugd classificeerde - een expliciet heren/dames-woord
// krijgt voorrang, en O25+ geldt sowieso als senioren (jeugd loopt t/m O19).
const _SENIOR_KEYWORD_RE = /\b(heren|dames)\b/i
const _AGE_NUM_RE = /O(\d+)/i
export function isJeugd(comp) {
  if (_SENIOR_KEYWORD_RE.test(comp.name)) return false
  const m = _AGE_NUM_RE.exec(comp.name)
  return m ? parseInt(m[1], 10) < 20 : false
}
export const AGE_GROUP_ORDER = ['Senioren', 'Jeugd']

// Normaliseer KNHB-districtnamen naar de canonieke kaart-sleutels (item 650).
// KNHB API geeft soms koppeltekens ("Noord-Nederland") terug i.p.v. spaties.
const _DIST_NORM = {
  'Noord-Nederland': 'Noord Nederland',
  'Midden-Nederland': 'Midden Nederland',
  'Oost-Nederland': 'Oost Nederland',
  'Noord-Oost-Nederland': 'Oost Nederland',
  'Noord-Oost Nederland': 'Oost Nederland',
  'Zuid-Nederland': 'Zuid Nederland',
}
export function normalizeDistrict(d) { return _DIST_NORM[d] || d }

// Sortering op klasse-hiërarchie — strip "Landelijke" / "Voorcompetitie" prefix zodat
// "Landelijke Subtopklasse" op dezelfde plek belandt als "Subtopklasse".
export function classRank(name) {
  if (/^Voorcompetitie\b/i.test(name)) {
    // Voorcompetitie met een herkenbaar niveau → op niveau sorteren maar achteraan binnen die rang
    const suf = name.replace(/^Voorcompetitie\s+/i, '').trim()
    const inner = classRank(suf)
    return inner < 99 ? inner + 100 : 200
  }
  const bare = name.replace(/^Landelijk[e]?\s+/i, '').trim()
  if (/^Topklasse/i.test(bare))       return 0
  if (/^Competitie\b/i.test(bare))    return 1   // "Landelijke Competitie" → bare "Competitie"
  if (/^Super\s+O/i.test(bare))       return 2   // "Super O18", "Super O16", "Super O14"
  if (/^Subtop/i.test(bare))          return 3
  if (/^Hoofdklasse/i.test(bare))     return 4
  if (/^IDC\b/i.test(bare))           return 5   // Interdistrict Competitie
  if (/^1e\s+Klas/i.test(bare))       return 6
  if (/^2e\s+Klas/i.test(bare))       return 7
  if (/^3e\s+Klas/i.test(bare))       return 8
  if (/^4e\s+Klas/i.test(bare))       return 9
  if (/^5e\s+Klas/i.test(bare))       return 10
  if (/^6e\s+Klas/i.test(bare))       return 11
  if (/^7e\s+Klas/i.test(bare))       return 12
  if (/^Afdeling/i.test(bare))        return 13
  return 99
}

// Groepeer competities op naam, gesorteerd op klasse-hiërarchie (RFTR-B6,
// item 989, fase 6.5) - was 2x identiek in DiscoveryCompetities.jsx
// (per-district- en per-competitie-weergave).
export function groupByNameSorted(items) {
  const byName = {}
  for (const c of items) {
    if (!byName[c.name]) byName[c.name] = []
    byName[c.name].push(c)
  }
  const names = Object.keys(byName).sort((a, b) => {
    const d = classRank(a) - classRank(b)
    return d !== 0 ? d : a.localeCompare(b, 'nl')
  })
  return { byName, names }
}
