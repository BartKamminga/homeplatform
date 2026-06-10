import { useState, useEffect, useCallback } from 'react'
import TopBar from '../components/TopBar.jsx'
import { listTasks } from '../api.js'

const REPEAT_LABEL = { daily: 'Dagelijks', weekly: 'Wekelijks', monthly: 'Maandelijks' }
const WHEN_LABEL   = { morning: 'Ochtend', afternoon: 'Middag', allday: 'Heledag' }
const DAY_LABEL    = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']

function routineSubtitle(r) {
  const parts = [REPEAT_LABEL[r.repeat] ?? r.repeat]
  if (r.repeat === 'weekly' && r.day_of_week != null) parts.push(DAY_LABEL[r.day_of_week])
  parts.push(WHEN_LABEL[r.when] ?? r.when)
  return parts.join(' · ')
}

export default function RoutinesPage({ onAdd, onEdit, refreshKey }) {
  const [routines, setRoutines] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const all = await listTasks()
      setRoutines(all.filter(t => t.repeat !== 'once'))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  return (
    <div>
      <TopBar title="Routines" onAdd={onAdd} />

      {loading && (
        <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 14 }}>
          Laden…
        </div>
      )}

      {error && (
        <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--danger)', fontSize: 14 }}>
          {error}
        </div>
      )}

      {!loading && !error && routines.length === 0 && (
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 14 }}>
          Nog geen routines. Voeg een terugkerende taak toe.
        </div>
      )}

      {!loading && !error && routines.length > 0 && (
        <>
          <div style={{ padding: '12px 16px 4px', fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            Terugkerend
          </div>
          {routines.map(r => (
            <div
              key={r.id}
              onClick={() => onEdit?.(r)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '0.5px solid var(--border)', cursor: 'pointer' }}
            >
              {r.photo_path
                ? <img src={`/api/uploads/${r.photo_path}`} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className="ti ti-repeat" style={{ fontSize: 16, color: 'var(--accent-text)' }} aria-hidden="true" />
                  </div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {routineSubtitle(r)}
                </div>
              </div>
              <i className="ti ti-chevron-right" style={{ fontSize: 16, color: 'var(--text-faint)' }} aria-hidden="true" />
            </div>
          ))}
        </>
      )}
    </div>
  )
}
