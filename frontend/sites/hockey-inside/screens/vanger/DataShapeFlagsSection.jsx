import { useState, useEffect } from 'react'
import { getDataShapeFlags } from '../../api.js'

// item 1167: signaal dat de scraper (Scout/Ghost) een veld miste dat er
// eerder wel was (bv. district) - vervolg op 1166 (HelloFresh-competitiebug),
// zodat een volgende bronwijziging opvalt voordat poules er weer aan
// onderdoor gaan.
export default function DataShapeFlagsSection({ section }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    getDataShapeFlags(14, 50).then(setData).catch(() => {})
  }, [])

  if (!data || data.rows.length === 0) return null

  return (
    <div>
      {section(`⚠️ Scandata-afwijkingen (${data.total}, laatste ${data.days}d)`)}
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: -4, marginBottom: 10 }}>
        De scraper miste een verwacht veld (bv. district) - de bestaande competitie-koppeling is behouden i.p.v. de poule te verhuizen.
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px 4px 0', fontWeight: 600 }}>Wanneer</th>
              <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600 }}>Competitie</th>
              <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600 }}>Poule</th>
              <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600 }}>Ontbrekend veld</th>
              <th style={{ textAlign: 'left', padding: '4px 0 4px 8px', fontWeight: 600 }}>Gescrapete naam</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)' }}>
                <td style={{ padding: '5px 8px 5px 0', color: 'var(--color-text-muted)' }}>{new Date(r.created_at).toLocaleString('nl-NL')}</td>
                <td style={{ padding: '5px 8px' }}>{r.competition_name || '—'}</td>
                <td style={{ padding: '5px 8px' }}>{r.poule_name || r.poule_id}</td>
                <td style={{ padding: '5px 8px', color: 'var(--color-warning)' }}>{r.missing_field}</td>
                <td style={{ padding: '5px 0 5px 8px', color: 'var(--color-text-muted)' }}>{r.detail || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
