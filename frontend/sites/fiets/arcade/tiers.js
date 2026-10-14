import { scoreTierKey, t } from '../i18n.js'

// Arcade-kleuren per score-tier (item 1337): goed = groen, matig = geel/oranje, slecht = roze.
export const TIER_COLOR = { excellent: '#5dff9e', good: '#ffe66d', fair: '#ff9640', poor: '#ff2e88' }

export function tierColor(score) {
  return score == null ? '#8a8aa8' : TIER_COLOR[scoreTierKey(score)]
}

// Factor-kleuren (grafiek-opbouw, gewichten, lab).
export const FACTOR_COLOR = { rain: '#cdd5e4', temp: '#ff9640', sun: '#ffe66d', wind: '#24e8ff' }

export function weightRows(lang, weights, noteKeys = {}) {
  const keys = ['rain', 'temp', 'sun', 'wind']
  const total = keys.reduce((sum, k) => sum + Number(weights[k] || 0), 0) || 1
  return keys
    .map(key => ({
      key, label: t(lang, `weight.${key}`), note: t(lang, noteKeys[key] ?? `weightNote.${key}`),
      pct: Math.round(Number(weights[key] || 0) / total * 100), color: FACTOR_COLOR[key],
    }))
    .sort((a, b) => b.pct - a.pct)
}

export const up = s => String(s).toUpperCase()
