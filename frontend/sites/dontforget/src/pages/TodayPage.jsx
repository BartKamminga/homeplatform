import { useState } from 'react'
import TopBar from '../components/TopBar.jsx'
import TaskItem from '../components/TaskItem.jsx'

const DEMO = [
  { id:1, title:'Wasmachine uitruimen', when:'morning', repeat:'weekly',  priority:'normal', done:false, photo:true },
  { id:2, title:'Koffie zetten',        when:'morning', repeat:'daily',   priority:'normal', done:true,  photo:false },
  { id:3, title:'Boodschappen doen',    when:'afternoon',repeat:'once',   priority:'high',   done:false, photo:false },
  { id:4, title:'Vaatwasser inruimen',  when:'afternoon',repeat:'daily',  priority:'normal', done:false, photo:true },
  { id:5, title:'Prullenbak buiten',    when:'evening', repeat:'weekly',  priority:'normal', done:false, photo:false },
]

const MOMENTS = [
  { key:'morning',   label:'Ochtend' },
  { key:'afternoon', label:'Middag' },
  { key:'evening',   label:'Avond' },
]

const today = new Date().toLocaleDateString('nl-NL', { weekday:'long', day:'numeric', month:'long' })

export default function TodayPage({ onAdd }) {
  const [tasks, setTasks] = useState(DEMO)

  function toggle(id) {
    setTasks(t => t.map(task => task.id === id ? { ...task, done: !task.done } : task))
  }

  return (
    <div>
      <TopBar title="Vandaag" subtitle={today} onAdd={onAdd} />
      {MOMENTS.map(m => {
        const mt = tasks.filter(t => t.when === m.key)
        if (!mt.length) return null
        return (
          <div key={m.key}>
            <div style={{ padding:'12px 16px 4px', fontSize:11, fontWeight:500, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--text-faint)' }}>
              {m.label}
            </div>
            {mt.map(t => <TaskItem key={t.id} task={t} onToggle={toggle} onEdit={() => {}} />)}
          </div>
        )
      })}
    </div>
  )
}
