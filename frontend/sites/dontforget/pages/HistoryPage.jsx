import { useState, useEffect, useCallback } from 'react'
import TopBar from '../components/TopBar.jsx'
import { listTasks } from '../api.js'
import { api } from '@core/api.js'

function dayLabel(dateStr) {
  if (!dateStr) return 'Onbekend'
  const d = new Date(dateStr)
  const now = new Date()
  const todayStart     = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart - 86400000)
  const taskStart      = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (taskStart.getTime() === todayStart.getTime())     return 'Vandaag'
  if (taskStart.getTime() === yesterdayStart.getTime()) return 'Gisteren'
  return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
}

function timeStr(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

export default function HistoryPage() {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [me,      setMe]      = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [tasks, user] = await Promise.all([
        listTasks(true),
        api.get('/api/auth/me'),
      ])
      tasks.sort((a, b) => new Date(b.completed_at || b.created_at) - new Date(a.completed_at || a.created_at))
      setItems(tasks)
      setMe(user)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    window.addEventListener('groupchange', load)
    return () => window.removeEventListener('groupchange', load)
  }, [load])

  const groups = []
  const idx = {}
  for (const task of items) {
    const label = dayLabel(task.completed_at)
    if (idx[label] === undefined) { idx[label] = groups.length; groups.push({ label, tasks: [] }) }
    groups[idx[label]].tasks.push(task)
  }

  return (
    <div>
      <TopBar title="Geschiedenis" />

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

      {!loading && !error && items.length === 0 && (
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 14 }}>
          Nog niets afgerond.
        </div>
      )}

      {!loading && !error && groups.map(g => (
        <div key={g.label}>
          <div style={{ padding: '12px 16px 4px', fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            {g.label}
          </div>
          {g.tasks.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '0.5px solid var(--border)' }}>
              {t.photo_path
                ? <img src={`/api/uploads/${t.photo_path}`} style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} alt="" />
                : (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--done, #34c759)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className="ti ti-check" style={{ fontSize: 14, color: '#fff' }} aria-hidden="true" />
                  </div>
                )
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.55, textDecoration: 'line-through' }}>
                  {t.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>
                  {timeStr(t.completed_at)}{me?.username ? ` · ${me.username}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
