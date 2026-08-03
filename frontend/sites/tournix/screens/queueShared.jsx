import { useState } from 'react'
import { api } from '@core/api.js'

// ── Pill / variant styling ────────────────────────────────────────────────────

export const VARIANT = {
  ok:      { bg: 'color-mix(in srgb, var(--color-success) 15%, var(--color-surface))', fg: 'var(--color-success)', border: 'var(--color-success)' },
  partial: { bg: 'color-mix(in srgb, var(--color-warning) 15%, var(--color-surface))', fg: 'var(--color-warning)', border: 'var(--color-warning)' },
  muted:   { bg: 'var(--color-surface)', fg: 'var(--color-text-muted)', border: 'var(--color-border)' },
}

export function pill(variant) {
  const c = VARIANT[variant] || VARIANT.muted
  return { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '2px 8px', borderRadius: 99, background: c.bg, color: c.fg, border: `1px solid ${c.border}`, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
}

// ── Stat-box styles ───────────────────────────────────────────────────────────

export const statBox = { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, minWidth: 60 }
export const statNum = { fontSize: 20, fontWeight: 700, lineHeight: 1 }
export const statLbl = { fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2, textAlign: 'center' }

// ── Format helpers ────────────────────────────────────────────────────────────

export function fmtDuration(ms) {
  if (!ms && ms !== 0) return null
  if (ms < 1000) return ms + 'ms'
  return (ms / 1000).toFixed(1) + 's'
}

export function fmtBytes(b) {
  if (!b) return null
  if (b < 1024) return b + 'B'
  if (b < 1024 * 1024) return Math.round(b / 1024) + 'kB'
  return (b / (1024 * 1024)).toFixed(1) + 'MB'
}

// ── Cmd conclusion label ──────────────────────────────────────────────────────

export function makeCmdConclusion(cmd, summary) {
  if (!summary) return null
  if (summary.parse_failed) return '⚠ Parse mislukt — raw data onleesbaar'
  if (cmd.cmd_type === 'get_poule') {
    const { teams = 0, standings = 0, matches_total = 0, matches_played = 0, season } = summary
    if (standings === 0 && matches_total === 0) return `Poule leeg – nog geen indeling${season ? ' · ' + season : ''}`
    const base = `${teams || standings} teams`
    if (matches_total === 0) return base + ' · geen wedstrijdschema'
    if (matches_played === 0) return base + ` · ${matches_total} wedstrijden · nog niet gespeeld`
    return base + ` · ${matches_played}/${matches_total} gespeeld (${Math.round((matches_played / matches_total) * 100)}%)`
  }
  if (cmd.cmd_type === 'scan_club') {
    const { teams_found = 0, teams_added = 0, teams_new_poule = 0, teams_disappeared = 0 } = summary
    const parts = [`${teams_found} teams`]
    if (teams_added > 0)       parts.push(`+${teams_added} nieuw`)
    if (teams_new_poule > 0)   parts.push(`${teams_new_poule} nieuwe poule`)
    if (teams_disappeared > 0) parts.push(`${teams_disappeared} niet ontvangen`)
    if (teams_added === 0 && teams_new_poule === 0 && teams_disappeared === 0) parts.push('geen wijzigingen')
    return parts.join(' · ')
  }
  if (cmd.cmd_type === 'get_clubs') {
    const { clubs_found = 0, clubs_added = 0, clubs_updated = 0 } = summary
    const parts = [`${clubs_found} clubs`]
    if (clubs_added > 0)   parts.push(`+${clubs_added} nieuw`)
    if (clubs_updated > 0) parts.push(`${clubs_updated} bijgewerkt`)
    if (clubs_added === 0 && clubs_updated === 0) parts.push('geen wijzigingen')
    return parts.join(' · ')
  }
  if (cmd.cmd_type === 'get_competition_detail') {
    const { poules_processed = 0, teams_found = 0, get_poule_cmds_queued = 0, competition = '' } = summary
    const parts = [competition || `comp #${cmd.params?.comp_id ?? ''}`]
    if (poules_processed > 0) parts.push(`${poules_processed} poule${poules_processed !== 1 ? 's' : ''}`)
    if (teams_found > 0)      parts.push(`${teams_found} teams`)
    if (get_poule_cmds_queued > 0) parts.push(`+${get_poule_cmds_queued} poule cmds`)
    return parts.join(' · ')
  }
  if (cmd.cmd_type === 'get_competitions') {
    const { competitions_found = 0, upserted = 0 } = summary
    const parts = [`${competitions_found} competities`]
    if (upserted > 0) parts.push(`${upserted} opgeslagen`)
    return parts.join(' · ')
  }
  return null
}

// ── Type badge map ────────────────────────────────────────────────────────────

export const TYPE_BADGE = {
  get_poule:              { label: 'poule',      color: '#1565c0', bg: '#dbeafe' },
  scan_club:              { label: 'club',       color: '#15803d', bg: '#dcfce7' },
  get_clubs:              { label: 'clubs',      color: '#7c3aed', bg: '#ede9fe' },
  get_competition_detail: { label: 'competitie', color: '#b45309', bg: '#fef3c7' },
  get_competitions:       { label: 'comp-lijst', color: '#9a3412', bg: '#fff7ed' },
}

// ── useQueueCmd hook ──────────────────────────────────────────────────────────
// Gedeeld door VangerTab en DiscoveryTab.
// onAdded: optionele callback na succesvolle toevoeging (bijv. loadCmdQueue).

export function useQueueCmd({ onAdded } = {}) {
  const [cmdAdding, setCmdAdding] = useState({})

  function addSingleCmd(type, params) {
    const key = type + '_' + (params.poule_id || params.external_id || params.comp_id || 'global')
    setCmdAdding(prev => ({ ...prev, [key]: 'adding' }))
    api.post('/api/tournix/discovery/vanger/cmd-queue/add', { cmd_type: type, params })
      .then(r => {
        setCmdAdding(prev => ({ ...prev, [key]: r.added ? 'added' : 'exists' }))
        onAdded?.()
        setTimeout(() => setCmdAdding(prev => { const n = { ...prev }; delete n[key]; return n }), 2000)
      })
      .catch(() => setCmdAdding(prev => { const n = { ...prev }; delete n[key]; return n }))
  }

  function cmdBtn(type, params, label, color, sz = 'sm') {
    const key = type + '_' + (params.poule_id || params.external_id || params.comp_id || 'global')
    const s   = cmdAdding[key]
    const base = sz === 'md'
      ? { fontSize: 11, padding: '4px 10px', borderRadius: 6 }
      : { fontSize: 10, padding: '1px 7px', borderRadius: 4 }
    return (
      <button
        disabled={!!s}
        onClick={e => { e.stopPropagation(); addSingleCmd(type, params) }}
        style={{ ...base,
          border: `1px solid ${s === 'added' ? 'var(--color-success)' : s === 'exists' ? 'var(--color-warning)' : color}`,
          color: s === 'added' ? 'var(--color-success)' : s === 'exists' ? 'var(--color-warning)' : color,
          background: 'none', cursor: s ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0,
          transition: 'color .2s, border-color .2s' }}>
        {s === 'adding' ? '…' : s === 'added' ? '✓' : s === 'exists' ? '⚠' : label}
      </button>
    )
  }

  return { addSingleCmd, cmdAdding, cmdBtn }
}
