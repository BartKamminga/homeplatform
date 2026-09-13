import { useState, useEffect } from 'react'
import { getActionSettings, getReports, getTimeline, getInterviewCandidates } from '../api.js'
import Thermometer from './Thermometer.jsx'

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })
}

function MatchTeaser({ label, item, onOpen }) {
  if (!item) return null
  return (
    <a href="#" onClick={e => { e.preventDefault(); onOpen(item.match_ref) }} className="yof-card"
      style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: '#999', marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{item.title}</div>
      <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
        {fmtDate(item.date)}{item.score_us != null ? ` · ${item.score_us}-${item.score_them}` : ''}
      </div>
    </a>
  )
}

export default function PublicHome({ onNavigate, onOpenMatch }) {
  const [settings, setSettings] = useState(null)
  const [interviews, setInterviews] = useState([])
  const [pastMatch, setPastMatch] = useState(null)
  const [nextMatch, setNextMatch] = useState(null)
  const [candidates, setCandidates] = useState([])

  useEffect(() => {
    getActionSettings().then(setSettings).catch(() => {})
    getReports(null, 'interview').then(rows => setInterviews(rows.slice(0, 2))).catch(() => {})
    getTimeline().then(items => {
      const now = new Date()
      const past = items.filter(it => new Date(it.date) <= now)
      const future = items.filter(it => new Date(it.date) > now)
      const last = past[past.length - 1] || null
      const next = future[0] || null
      setPastMatch(last)
      setNextMatch(next)
      if (next) {
        getInterviewCandidates(next.match_ref).then(setCandidates).catch(() => {})
      }
    }).catch(() => {})
  }, [])

  return (
    <div>
      <div className="yof-hero">
        <div style={{ fontSize: 32 }}>🇫🇷</div>
        <h1>Samen op naar Parijs!</h1>
        <p>Volg het team, bekijk de wedstrijden en steun de actie voor onze teamtrip.</p>
        <div style={{ marginTop: 16 }}>
          <Thermometer settings={settings} />
        </div>
      </div>

      {(pastMatch || nextMatch) && (
        <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
          <MatchTeaser label="Laatste wedstrijd" item={pastMatch} onOpen={onOpenMatch} />
          <MatchTeaser label="Volgende wedstrijd" item={nextMatch} onOpen={onOpenMatch} />
        </div>
      )}

      {candidates.length > 0 && (
        <div className="yof-card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: '#a3245c', fontWeight: 700, marginBottom: 8 }}>
            Volgende week in de kijker
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {candidates.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', overflow: 'hidden',
                  background: 'linear-gradient(160deg, #2a2a2a, #0b0b0b)', color: '#f4c81e',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                }}>
                  {c.photo_url
                    ? <img src={c.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : c.name.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 13 }}>{c.name}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#999', margin: '8px 0 0' }}>
            Zij vertellen binnenkort over de wedstrijd &mdash; hou &ldquo;In de kijker&rdquo; in de gaten!
          </p>
        </div>
      )}

      {interviews.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: '#999', margin: '0 0 8px' }}>
            In de kijker
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {interviews.map(r => (
              <a key={r.id} href="#" onClick={e => { e.preventDefault(); onNavigate('spotlight') }}
                className="yof-card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                <h3 style={{ margin: '0 0 4px', fontSize: 14 }}>&ldquo;{r.title}&rdquo;</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
                  {r.body.length > 90 ? r.body.slice(0, 90) + '...' : r.body}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
