// Gedeelde hockey-type-afleiding (RFTR-B6, item 989, fase 6.5) - was
// letterlijk identiek in StatsTab.jsx en discovery/DiscoveryClubs.jsx.
export function resolveHockeyType(t) {
  if (t.hockey_type === 'VE' || t.hockey_type === 'ZA') return t.hockey_type
  if (t.short_name && t.short_name[0] === 'z') return 'ZA'
  return 'VE'
}
