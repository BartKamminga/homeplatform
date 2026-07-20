import { useState, useEffect } from 'react'
import { api } from '@core/api.js'
import { ghostBtn } from './styles.js'

const statBox = { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, minWidth: 60 }
const statNum = { fontSize: 20, fontWeight: 700, lineHeight: 1 }
const statLbl = { fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2, textAlign: 'center' }

function pill(text, variant) {
  const colors = {
    ok:      { bg: 'color-mix(in srgb, var(--color-success) 15%, var(--color-surface))', fg: 'var(--color-success)', border: 'var(--color-success)' },
    partial: { bg: 'color-mix(in srgb, var(--color-warning) 15%, var(--color-surface))', fg: 'var(--color-warning)', border: 'var(--color-warning)' },
    muted:   { bg: 'var(--color-surface)', fg: 'var(--color-text-muted)', border: 'var(--color-border)' },
  }
  const c = colors[variant] || colors.muted
  return { fontSize: 11, padding: '2px 8px', borderRadius: 99, background: c.bg, color: c.fg, border: `1px solid ${c.border}`, fontVariantNumeric: 'tabular-nums' }
}

export default function DiscoveryTab() {
  const [clubs,      setClubs]      = useState([])
  const [youthTeams, setYouthTeams] = useState([])
  const [queue,      setQueue]      = useState({ total: 0, captured: 0, missing: 0, poules: [] })
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')

  function load() {
    setLoading(true)
    setError('')
    Promise.all([
      api.get('/api/tournix/discovery/clubs'),
      api.get('/api/tournix/discovery/teams?category=Junioren'),
      api.get('/api/tournix/discovery/youth-queue'),
    ]).then(([clubsRes, teamsRes, queueRes]) => {
      setClubs(clubsRes.clubs || [])
      setYouthTeams(teamsRes.teams || [])
      setQueue(queueRes)
    }).catch(e => setError(e.message)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Per-club: jeugdteams
  const teamsByClub = {}
  for (const t of youthTeams) {
    teamsByClub[t.club_external_id] = (teamsByClub[t.club_external_id] || 0) + 1
  }

  // Per-club: poule coverage
  const poulesByClub = {}
  for (const p of queue.poules || []) {
    if (!poulesByClub[p.club_external_id]) poulesByClub[p.club_external_id] = { total: 0, captured: 0 }
    poulesByClub[p.club_external_id].total++
    if (p.captured) poulesByClub[p.club_external_id].captured++
  }

  const detailLoaded = clubs.filter(c => c.detail_loaded).length
  const noDetail     = clubs.length - detailLoaded
  const activeClubs  = clubs.filter(c => teamsByClub[c.external_id])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Samenvatting */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <div style={statBox}>
          <span style={statNum}>{clubs.length}</span>
          <span style={statLbl}>clubs</span>
        </div>
        <div style={statBox}>
          <span style={statNum}>{detailLoaded}</span>
          <span style={statLbl}>detail geladen</span>
        </div>
        <div style={statBox}>
          <span style={statNum}>{youthTeams.length}</span>
          <span style={statLbl}>jeugdteams O11–O18</span>
        </div>
        <div style={{
          ...statBox,
          borderColor: queue.captured === queue.total && queue.total > 0 ? 'var(--color-success)' : 'var(--color-border)',
        }}>
          <span style={{
            ...statNum,
            color: queue.captured === queue.total && queue.total > 0 ? 'var(--color-success)' : 'var(--color-text)',
          }}>
            {queue.captured}/{queue.total}
          </span>
          <span style={statLbl}>poules gevangen</span>
        </div>
        <button onClick={load} style={{ ...ghostBtn, alignSelf: 'center' }}>↻ Vernieuwen</button>
      </div>

      {error   && <p style={{ color: 'var(--color-danger)',    fontSize: 12 }}>{error}</p>}
      {loading && <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Laden…</p>}

      {noDetail > 0 && !loading && (
        <div style={{
          fontSize: 11, color: 'var(--color-text-muted)',
          padding: '6px 10px', background: 'var(--color-surface)',
          borderRadius: 8, border: '1px dashed var(--color-border)',
        }}>
          ⚠️ {noDetail} clubs zonder clubdetail — surf via app.hockeyweerelt.nl en laat de vanger draaien
        </div>
      )}

      {/* Clubs met jeugdteams */}
      {activeClubs.map(c => {
        const yCount   = teamsByClub[c.external_id] || 0
        const pStats   = poulesByClub[c.external_id]
        const captured = pStats ? pStats.captured : 0
        const total    = pStats ? pStats.total    : 0
        const pVariant = total === 0 ? 'muted' : captured === total ? 'ok' : captured > 0 ? 'partial' : 'muted'

        return (
          <div key={c.external_id} style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 10, padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{c.friendly_name || c.name}</span>
              {c.city && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.city}</span>}

              <span style={pill(c.detail_loaded ? '✓ detail' : '–', c.detail_loaded ? 'ok' : 'muted')}>
                {c.detail_loaded ? '✓ detail' : '–'}
              </span>

              <span style={pill(`${yCount} jeugdteams`, 'muted')}>
                {yCount} jeugdteams
              </span>

              {pStats && (
                <span style={pill(`${captured}/${total} poules`, pVariant)}>
                  {captured}/{total} poules
                </span>
              )}
            </div>
          </div>
        )
      })}

      {!loading && activeClubs.length === 0 && clubs.length > 0 && (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Geen clubs met jeugdteams gevonden — laad eerst clubdetails via de vanger
        </div>
      )}

      {!loading && clubs.length === 0 && (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Geen clubs in de database — surf naar app.hockeyweerelt.nl met de hockey-vanger actief
        </div>
      )}
    </div>
  )
}
