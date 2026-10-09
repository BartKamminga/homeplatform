import { useState, useEffect } from 'react'
import { getPhaseWatch, addPublicationComp, syncCompetition } from '../../api.js'
import { Btn } from '../ui.jsx'

// Item 1254: voortgang van de volglijst ('wacht op nieuwe fase' / 'wacht op
// zaal-indeling'). Aanzetten gebeurt per competitie in Publicatie ->
// Competities; hier zie je hoe ver het is en koppel je een gevonden nieuwe
// competitie direct aan de publicatie.
const KIND_LABEL = { next_phase: '⏳ Next phase', zaal: '🏒 Indoor' }

export default function PhaseWatchSection({ section }) {
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState({})

  const load = () => getPhaseWatch().then(setRows).catch(() => {})
  useEffect(() => { load() }, [])

  async function link(row, comp) {
    const key = `${row.publication_id}-${comp.competition_id}`
    setBusy(prev => ({ ...prev, [key]: true }))
    try {
      await addPublicationComp(row.publication_id, { competition_id: comp.competition_id, order: 999 })
      syncCompetition(comp.competition_id).catch(() => {})
      await load()
    } finally {
      setBusy(prev => ({ ...prev, [key]: false }))
    }
  }

  if (!rows || rows.length === 0) return null

  const cell = { padding: '5px 8px', verticalAlign: 'top' }
  return (
    <div>
      {section(`Watch list (${rows.length})`)}
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: -4, marginBottom: 10 }}>
        Competitions waiting for a new phase or the indoor schedule. The scanner checks them daily and sends a push when new poules are found.
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={{ ...cell, textAlign: 'left', paddingLeft: 0 }}>Competition</th>
              <th style={{ ...cell, textAlign: 'left' }}>Waiting for</th>
              <th style={{ ...cell, textAlign: 'right' }}>Teams with new poule</th>
              <th style={{ ...cell, textAlign: 'right' }}>Clubs scanned</th>
              <th style={{ ...cell, textAlign: 'left', paddingRight: 0 }}>Found</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={`${r.link_id}-${r.kind}`} style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)' }}>
                <td style={{ ...cell, paddingLeft: 0 }}>
                  <div style={{ fontWeight: 600 }}>{r.competition_name}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                    {[r.class_name, r.publication_name].filter(Boolean).join(' · ')}
                  </div>
                </td>
                <td style={cell}>
                  <div>{KIND_LABEL[r.kind] || r.kind}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                    since {new Date(r.since).toLocaleDateString('en-GB')}
                    {!r.waiting && ' · current phase still running'}
                  </div>
                </td>
                <td style={{ ...cell, textAlign: 'right' }}>
                  {r.teams_with_new_poule}/{r.teams_total}
                  {r.teams_captured < r.teams_with_new_poule && (
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{r.teams_captured} fetched</div>
                  )}
                </td>
                <td style={{ ...cell, textAlign: 'right' }}>{r.clubs_scanned_since}/{r.clubs_total}</td>
                <td style={{ ...cell, paddingRight: 0 }}>
                  {r.same_comp_new_poules > 0 && (
                    <div>{r.same_comp_new_poules} new poule(s) in this competition</div>
                  )}
                  {r.found_competitions.filter(c => c.competition_id !== r.competition_id).map(c => {
                    const key = `${r.publication_id}-${c.competition_id}`
                    return (
                      <div key={c.competition_id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span>{c.name}{c.class_name ? ` | ${c.class_name}` : ''} ({c.poules})</span>
                        {c.linked
                          ? <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>linked</span>
                          : <Btn onClick={() => link(r, c)} disabled={busy[key]}>{busy[key] ? '…' : 'Link to publication'}</Btn>}
                      </div>
                    )
                  })}
                  {r.same_comp_new_poules === 0 && r.found_competitions.length === 0 && (
                    <span style={{ color: 'var(--color-text-muted)' }}>nothing yet</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
