import { useState } from 'react'
import { setClubColor } from '../../api.js'
import usePageBlocks from '../../features/blocks/usePageBlocks.js'
import { toCardModel, headerSettingId, HEADER_STYLES, DEFAULT_HEADER_STYLE, DEFAULT_LIST_STYLE, DEFAULT_HOME_STYLE } from '../../features/matches/matchCardModel.js'

// Weergave van de wedstrijd in Wedstrijd-instellingen: kopstijl (wedstrijdpagina) en
// lijststijl (wedstrijdenlijst) en startpaginastijl A/B/C voor deze wedstrijd (of de standaard
// van de pagina Wedstrijden) en de clubkleuren. Een
// clubkleur geldt voor die club overal (alle wedstrijden), niet alleen hier.
export default function MatchLookSettings({ item }) {
  const { setting, setSetting, isPlatformAdmin } = usePageBlocks()
  const model = toCardModel(item)
  const [colors, setColors] = useState(() => ({ home: model?.home.color, away: model?.away.color }))
  const [error, setError] = useState('')
  if (!model) return null

  const id = headerSettingId(item.match_ref)
  const rows = [
    { label: 'Kopstijl', key: 'style', pageDefault: setting('page.timeline', 'match_header', DEFAULT_HEADER_STYLE) },
    { label: 'Lijststijl', key: 'list_style', pageDefault: setting('page.timeline', 'list_style', DEFAULT_LIST_STYLE) },
    { label: 'Startpagina', key: 'home_style', pageDefault: setting('page.timeline', 'home_style', DEFAULT_HOME_STYLE) },
  ]

  async function saveColor(sideKey, color) {
    const clubId = model[sideKey].clubId
    if (!clubId) return
    setError('')
    try {
      const res = await setClubColor(clubId, color)
      setColors(c => ({ ...c, [sideKey]: res.color || c[sideKey] }))
    } catch (e) { setError(e.message) }
  }

  const btn = active => ({ padding: '3px 10px', background: active ? '#12203c' : 'white', color: active ? 'white' : undefined })

  return (
    <div style={{ marginBottom: 14, fontSize: 13 }}>
      {rows.map(row => {
        const own = setting(id, row.key, null)
        const choices = [{ value: null, label: `Standaard (${row.pageDefault})` }, ...HEADER_STYLES.map(s => ({ value: s.value, label: s.value }))]
        return (
          <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <strong style={{ marginRight: 4, minWidth: 70 }}>{row.label}</strong>
            {choices.map(c => (
              <button key={String(c.value)} className="yof-btn-secondary" disabled={!isPlatformAdmin}
                onClick={() => setSetting(id, row.key, c.value)} style={btn(own === c.value)}>{c.label}</button>
            ))}
          </div>
        )
      })}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <strong>Clubkleuren</strong>
        {['home', 'away'].map(sideKey => (
          <label key={sideKey} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="color" value={colors[sideKey]} disabled={!isPlatformAdmin || !model[sideKey].clubId}
              onChange={e => setColors(c => ({ ...c, [sideKey]: e.target.value }))}
              onBlur={e => saveColor(sideKey, e.target.value)}
              style={{ width: 34, height: 26, padding: 0, border: '1px solid #ddd', borderRadius: 6 }} />
            <span>{model[sideKey].name}</span>
            {isPlatformAdmin && model[sideKey].clubId && (
              <button className="yof-btn-secondary" style={{ fontSize: 11, padding: '2px 8px' }} title="Kleur weer automatisch uit het logo halen"
                onClick={() => saveColor(sideKey, null)}>Automatisch</button>
            )}
          </label>
        ))}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 11, color: '#888' }}>Een clubkleur geldt voor die club bij alle wedstrijden. Automatisch = uit het clublogo.</p>
      {error && <p style={{ color: '#c23b3b', fontSize: 12 }}>{error}</p>}
    </div>
  )
}
