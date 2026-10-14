// Keelson helpers around the catalog from /api/keelson/catalog.

export const STATUS_LABEL = { present: 'Present', partial: 'Partial', missing: 'Missing' }
export const SYSTEM_STATUS_LABEL = { active: 'Active', planned: 'Planned', archived: 'Archived' }
export const KIND_LABEL = { platform: 'Platform', product: 'Product', tool: 'Tool' }

export const layerVar = (layerKey) => `var(--ks-${layerKey})`

export function indexCatalog(catalog) {
  const dims = Object.fromEntries(catalog.dimensions.map((d) => [d.key, d]))
  const kinds = Object.fromEntries(catalog.kinds.map((k) => [k.key, k]))
  const kindsByDim = {}
  catalog.kinds.forEach((k) => { (kindsByDim[k.dimension] ||= []).push(k) })
  return { ...catalog, dims, kinds, kindsByDim }
}

export const dimColor = (cat, dimKey) => layerVar(cat.dims[dimKey]?.layer || 'direction')

// Share of dimensions that have at least one element
export function coverage(cat, system) {
  const per = system.elements_per_dimension || {}
  const covered = cat.dimensions.filter((d) => per[d.key]).length
  return { covered, total: cat.dimensions.length }
}

// Verbs the catalog expects from one kind to another, most specific first
export function suggestedVerbs(cat, fromKind, toKind) {
  const exact = cat.relations.filter((r) => r.from === fromKind && r.to === toKind).map((r) => r.verb)
  const loose = cat.relations.filter((r) => r.from === fromKind).map((r) => r.verb)
  return [...new Set([...exact, ...loose])].slice(0, 8)
}

export function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
