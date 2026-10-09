import { useState, useEffect } from 'react'
import { getPlayerCardModeration, getPlayerModeration, savePlayerCard } from '../../api.js'
import FifaCard from './FifaCard.jsx'
import { STAT_KEYS, STAT_LABELS, CARD_STYLES } from './fifaCardModel.js'

const input = { width: '100%', boxSizing: 'border-box', padding: 6, border: '1px solid #ddd', borderRadius: 8, fontSize: 14, textAlign: 'center' }
const toInt = v => (v === '' || v == null ? null : Math.max(1, Math.min(99, parseInt(v, 10) || 0)) || null)

// Spelerskaart in FIFA-stijl beheren, onderaan het profiel in het spelersbeheer:
// live/concept, stijl, de zes waarden en eventueel een eigen totaal (leeg =
// gemiddelde). Concept = bezoekers zien de gewone spelerskaart.
export default function PlayerCardAdmin({ playerId }) {
  const [player, setPlayer] = useState(null)
  const [card, setCard] = useState(null)
  const [stats, setStats] = useState({})
  const [override, setOverride] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function apply(c) {
    setCard(c)
    setStats(Object.fromEntries(STAT_KEYS.map(k => [k, c.stats[k] ?? ''])))
    setOverride(c.overall_override ?? '')
  }

  useEffect(() => {
    getPlayerModeration(playerId).then(setPlayer).catch(() => {})
    getPlayerCardModeration(playerId).then(apply).catch(e => setError(e.message))
  }, [playerId])

  async function save(body) {
    setSaving(true)
    setError('')
    try { apply(await savePlayerCard(playerId, body)) } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  function saveValues() {
    const ov = toInt(override)
    save({ stats: Object.fromEntries(STAT_KEYS.map(k => [k, toInt(stats[k])])), ...(ov ? { overall_override: ov } : { clear_override: true }) })
  }

  if (!card || !player) return error ? <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p> : null

  const filled = STAT_KEYS.map(k => toInt(stats[k])).filter(v => v != null)
  const average = filled.length ? Math.round(filled.reduce((a, b) => a + b, 0) / filled.length) : null
  const preview = { ...card, stats: Object.fromEntries(STAT_KEYS.map(k => [k, toInt(stats[k])])), overall: toInt(override) ?? average }

  return (
    <div className="yof-card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 10px', marginBottom: 12, borderRadius: 10, fontSize: 12, background: card.live ? '#dcfce7' : '#f1f2f5' }}>
        <strong style={{ flex: 1 }}>Spelerskaart</strong>
        <span style={{ color: card.live ? '#166534' : '#6b7280', fontWeight: 700 }}>{card.live ? 'Live' : 'Concept - niet op de site'}</span>
        <button className="yof-btn-secondary" style={{ background: 'white' }} disabled={saving} onClick={() => save({ live: !card.live })}>
          {card.live ? 'Naar concept' : 'Live zetten'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 160px', gap: 16, alignItems: 'start' }}>
        <div style={{ fontSize: 13 }}>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 4 }}>Stijl</label>
          <select value={card.style || ''} onChange={e => save({ style: e.target.value })} style={{ ...input, textAlign: 'left', marginBottom: 12 }}>
            <option value="">Standaard ({CARD_STYLES.find(s => s.value === card.effective_style)?.label || card.effective_style})</option>
            {CARD_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 6, marginBottom: 10 }}>
            {STAT_KEYS.map(k => (
              <label key={k} title={STAT_LABELS[k]} style={{ display: 'flex', flexDirection: 'column', gap: 3, fontWeight: 700, fontSize: 11, color: '#555' }}>
                {k}
                <input type="number" min="1" max="99" value={stats[k]} onChange={e => setStats(s => ({ ...s, [k]: e.target.value }))} style={input} />
              </label>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontWeight: 700 }}>Totaal</span>
            <input type="number" min="1" max="99" value={override} placeholder={average ?? '-'} onChange={e => setOverride(e.target.value)} style={{ ...input, width: 70 }} />
            <span style={{ color: '#888', fontSize: 12 }}>leeg = gemiddelde ({average ?? '-'})</span>
          </label>
          <button className="yof-btn-secondary" disabled={saving} onClick={saveValues}>{saving ? 'Opslaan...' : 'Waarden opslaan'}</button>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: '#888' }}>Speelster van de week krijgt standaard goud. Doelpunten dit seizoen komen uit de wedstrijden.</p>
          {error && <p style={{ color: '#c23b3b', fontSize: 12 }}>{error}</p>}
        </div>
        <FifaCard player={player} card={preview} style={card.style || card.effective_style} />
      </div>
    </div>
  )
}
