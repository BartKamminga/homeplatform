import { useState, useEffect, useCallback } from 'react'
import TopBar from '../components/TopBar.jsx'
import TaskItem from '../components/TaskItem.jsx'
import { listTasks, completeTask, updateTask } from '../api.js'

const MOMENTS = [
  { key: 'morning',   label: 'Ochtend' },
  { key: 'afternoon', label: 'Middag' },
  { key: 'allday',    label: 'Heledag' },
  { key: 'tomorrow',  label: 'Morgen' },
  { key: 'week',      label: 'Deze week' },
  { key: 'month',     label: 'Deze maand' },
]

const today = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
// Convert JS getDay() (0=Sunday) to our 0=Monday system
const todayDow = (new Date().getDay() + 6) % 7

function periodStart(unit) {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  if (unit === 'week')  d.setDate(d.getDate() - todayDow)
  if (unit === 'month') d.setDate(1)
  return d
}

function completedIn(task, unit) {
  if (!task.completed_at) return false
  return new Date(task.completed_at) >= periodStart(unit)
}

function isDoneForPeriod(task) {
  if (task.repeat === 'once')    return task.done
  if (task.repeat === 'daily')   return completedIn(task, 'day')
  if (task.repeat === 'weekly')  return completedIn(task, 'week')
  if (task.repeat === 'monthly') return completedIn(task, 'month')
  return task.done
}

function isForToday(task) {
  if (task.repeat === 'once')    return !task.done
  if (task.repeat === 'daily')   return !isDoneForPeriod(task)
  if (task.repeat === 'monthly') return !isDoneForPeriod(task)
  if (task.repeat === 'weekly') {
    const dayMatch = task.day_of_week === null || task.day_of_week === undefined || task.day_of_week === todayDow
    return dayMatch && !isDoneForPeriod(task)
  }
  return !task.done
}

export default function TodayPage({ onAdd, onEdit, refreshKey }) {
  const [tasks,   setTasks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const all = await listTasks()
      setTasks(all.filter(isForToday))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshKey])
  useEffect(() => {
    window.addEventListener('groupchange', load)
    return () => window.removeEventListener('groupchange', load)
  }, [load])

  async function toggle(task) {
    const wasDone = isDoneForPeriod(task)
    if (!wasDone) {
      // Optimistisch afvinken: taak verdwijnt direct uit de lijst
      const now = new Date().toISOString()
      setTasks(ts => ts.map(t => t.id === task.id ? { ...t, done: true, completed_at: now } : t))
      try {
        await completeTask(task.id)
      } catch {
        setTasks(ts => ts.map(t => t.id === task.id ? task : t))
      }
    } else {
      // Ongedaan maken: server updaten en dan herladen
      try {
        await updateTask(task.id, { done: false })
        await load()
      } catch {}
    }
  }

  if (loading) return (
    <>
      <TopBar title="Vandaag" subtitle={today} onAdd={onAdd} />
      <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 14 }}>
        Laden…
      </div>
    </>
  )

  if (error) return (
    <>
      <TopBar title="Vandaag" subtitle={today} onAdd={onAdd} />
      <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--danger)', fontSize: 14 }}>
        {error}
      </div>
    </>
  )

  const hasTasks = tasks.length > 0

  return (
    <div>
      <TopBar title="Vandaag" subtitle={today} onAdd={onAdd} />
      {!hasTasks && (
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 14 }}>
          Geen taken voor vandaag
        </div>
      )}
      {MOMENTS.map(m => {
        const mt = tasks.filter(t => t.when === m.key)
        if (!mt.length) return null
        return (
          <div key={m.key}>
            <div style={{ padding: '12px 16px 4px', fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
              {m.label}
            </div>
            {mt.map(t => (
              <TaskItem
                key={t.id}
                task={{ ...t, done: isDoneForPeriod(t) }}
                onToggle={() => toggle(t)}
                onEdit={() => onEdit(t)}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
