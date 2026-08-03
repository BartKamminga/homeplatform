import { useState, useEffect } from 'react'
import { api } from '@core/api.js'
import { statBox, statNum, statLbl } from './queueShared.jsx'

function resolveHockeyType(t) {
  if (t.hockey_type === 'VE' || t.hockey_type === 'ZA') return t.hockey_type
  if (t.short_name && t.short_name[0] === 'z') return 'ZA'
  return 'VE'
}

export default function StatsTab() {
  const [clubs,   setClubs]   = useState([])
  const [teams,   setTeams]   = useState([])
  const [queue,   setQueue]   = useState(null)
  const [errors,  setErrors]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/api/tournix/discovery/clubs'),
      api.get('/api/tournix/discovery/teams'),
      api.get('/api/tournix/discovery/poule-queue'),
      api.get('/api/tournix/discovery/plugin-errors?limit=5'),
    ]).then(([clubsRes, teamsRes, queueRes, errRes]) => {
      setClubs(clubsRes.clubs || [])
      setTeams(teamsRes.teams || [])
      setQueue(queueRes)
      setErrors(errRes.errors || [])
    }).finally(() => setLoading(false))
  }, [])

  const detailLoaded = clubs.filter(c => c.detail_loaded).length
  const noDetail     = clubs.length - detailLoaded
  const youthCount   = teams.filter(t => t.category_group_name === 'Junioren').length
  const seniorCount  = teams.filter(t => t.category_group_name !== 'Junioren').length
  const veldCount    = teams.filter(t => resolveHockeyType(t) === 'VE').length
  const zaalCount    = teams.filter(t => resolveHockeyType(t) === 'ZA').length

  if (loading) {
    return <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: 24, textAlign: 'center' }}>Laden…</div>
  }

  const section = (label) => (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>{label}</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div>
        {section('Clubs')}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={statBox}><span style={statNum}>{clubs.length}</span><span style={statLbl}>clubs</span></div>
          <div style={statBox}><span style={statNum}>{detailLoaded}</span><span style={statLbl}>detail geladen</span></div>
          {noDetail > 0 && (
            <div style={{ ...statBox, borderColor: '#f59e0b' }}>
              <span style={{ ...statNum, color: '#f59e0b' }}>{noDetail}</span>
              <span style={statLbl}>geen detail</span>
            </div>
          )}
        </div>
      </div>

      <div>
        {section('Teams')}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={statBox}><span style={statNum}>{teams.length}</span><span style={statLbl}>totaal</span></div>
          <div style={statBox}><span style={statNum}>{youthCount}</span><span style={statLbl}>jeugd</span></div>
          <div style={statBox}><span style={statNum}>{seniorCount}</span><span style={statLbl}>senioren</span></div>
          <div style={statBox}><span style={statNum}>{veldCount}</span><span style={statLbl}>🏑 veld</span></div>
          <div style={statBox}><span style={statNum}>{zaalCount}</span><span style={statLbl}>🏒 zaal</span></div>
        </div>
      </div>

      {queue && (
        <div>
          {section(`Poule coverage ${queue.target_season || '2026-2027'}`)}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ ...statBox, borderColor: queue.captured === queue.total && queue.total > 0 ? 'var(--color-success)' : 'var(--color-border)' }}>
              <span style={{ ...statNum, color: queue.captured === queue.total && queue.total > 0 ? 'var(--color-success)' : 'var(--color-text)' }}>
                {queue.captured}/{queue.total}
              </span>
              <span style={statLbl}>gevangen</span>
            </div>
            {queue.stale > 0 && (
              <div style={statBox}><span style={{ ...statNum, color: 'var(--color-text-muted)' }}>{queue.stale}</span><span style={statLbl}>oud seizoen</span></div>
            )}
            {queue.waiting > 0 && (
              <div style={statBox}><span style={{ ...statNum, color: 'var(--color-text-muted)' }}>{queue.waiting}</span><span style={statLbl}>⏳ wacht</span></div>
            )}
          </div>
          {queue.total > 0 && (
            <div style={{ marginTop: 10, height: 6, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', background: 'var(--color-success)',
                width: `${Math.round(queue.captured / queue.total * 100)}%`,
                transition: 'width 0.4s',
              }} />
            </div>
          )}
        </div>
      )}

      {errors.length > 0 && (
        <div>
          {section(`Plugin fouten (${errors.length})`)}
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '8px 12px', background: 'var(--color-surface)', borderRadius: 8, border: '1px solid var(--color-danger)' }}>
            Bekijk details in de Vanger tab.
          </div>
        </div>
      )}

    </div>
  )
}
