import { useState, useRef } from 'react'
import { api } from '@core/api.js'
import { uploadPhoto } from '../api.js'

const REPEAT   = ['Eenmalig', 'Dagelijks', 'Wekelijks', 'Maandelijks']
const HORIZONS = ['Vandaag', 'Morgen', 'Deze week', 'Deze maand']
const TIMES    = ['Ochtend', 'Middag', 'Heledag']
const PRIO     = ['Hoog', 'Normaal', 'Laag']
const DAYS     = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

const REPEAT_MAP  = { 'Eenmalig': 'once', 'Dagelijks': 'daily', 'Wekelijks': 'weekly', 'Maandelijks': 'monthly' }
const PRIO_MAP    = { 'Hoog': 'high', 'Normaal': 'normal', 'Laag': 'low' }
const HORIZON_MAP = { 'Vandaag': null, 'Morgen': 'tomorrow', 'Deze week': 'week', 'Deze maand': 'month' }
const TIME_MAP    = { 'Ochtend': 'morning', 'Middag': 'afternoon', 'Heledag': 'allday' }

const REPEAT_REV  = Object.fromEntries(Object.entries(REPEAT_MAP).map(([k,v]) => [v,k]))
const PRIO_REV    = Object.fromEntries(Object.entries(PRIO_MAP).map(([k,v]) => [v,k]))

function whenToHorizon(w) {
  return { tomorrow: 'Morgen', week: 'Deze week', month: 'Deze maand' }[w] ?? 'Vandaag'
}
function whenToTime(w) {
  return { morning: 'Ochtend', afternoon: 'Middag' }[w] ?? 'Heledag'
}

function Chips({ opts, value, onSelect, small }) {
  return (
    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
      {opts.map(o => (
        <div key={o} onClick={() => onSelect(o)} style={{
          padding: small ? '4px 10px' : '6px 14px',
          borderRadius:20, fontSize: small ? 11 : 12, cursor:'pointer',
          border: value === o ? 'none' : '0.5px solid var(--border)',
          background: value === o ? 'var(--accent-bg)' : 'var(--bg-secondary)',
          color: value === o ? 'var(--accent-text)' : 'var(--text-muted)',
        }}>
          {o}
        </div>
      ))}
    </div>
  )
}

export default function AddTask({ onClose, task, onSaved }) {
  const [repeat,    setRepeatState] = useState(task ? (REPEAT_REV[task.repeat] ?? 'Eenmalig') : 'Eenmalig')
  const [horizon,   setHorizon]     = useState(task ? whenToHorizon(task.when) : 'Vandaag')
  const [timeOfDay, setTimeOfDay]   = useState(task ? whenToTime(task.when) : 'Heledag')
  const [dayOfWeek, setDayOfWeek]   = useState(task?.day_of_week ?? null)
  const [prio,      setPrio]        = useState(task ? (PRIO_REV[task.priority] ?? 'Normaal') : 'Normaal')
  const [title,     setTitle]       = useState(task?.title ?? '')
  const [photoFile, setPhotoFile]   = useState(null)
  const [photoPreview, setPhotoPreview] = useState(task?.photo_path ? `/api/uploads/${task.photo_path}` : null)
  const [saving,    setSaving]      = useState(false)
  const [error,     setError]       = useState(null)
  const fileRef = useRef()
  const editing = !!task

  function handleRepeat(r) {
    setRepeatState(r)
  }

  function getWhen() {
    if (repeat !== 'Eenmalig') return 'allday'
    if (horizon !== 'Vandaag') return HORIZON_MAP[horizon]
    return TIME_MAP[timeOfDay]
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!title.trim()) { setError('Vul een titel in'); return }
    setSaving(true); setError(null)
    try {
      let photo_path = task?.photo_path ?? null
      if (photoFile) {
        const result = await uploadPhoto(photoFile)
        photo_path = result.path
      }
      const data = {
        title:       title.trim(),
        photo_path,
        when:        getWhen(),
        repeat:      REPEAT_MAP[repeat],
        priority:    PRIO_MAP[prio],
        day_of_week: repeat === 'Wekelijks' ? dayOfWeek : null,
      }
      if (editing) {
        await api.patch(`/api/dontforget/tasks/${task.id}`, data)
      } else {
        await api.post('/api/dontforget/tasks', data)
      }
      onSaved?.(); onClose()
    } catch (e) {
      setError(e.message || 'Er ging iets mis')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await api.delete(`/api/dontforget/tasks/${task.id}`)
      onSaved?.(); onClose()
    } catch (e) {
      setError(e.message || 'Verwijderen mislukt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', padding:'14px 16px', borderBottom:'0.5px solid var(--border)', background:'var(--bg-card)' }}>
        <span onClick={onClose} style={{ fontSize:13, color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
          <i className="ti ti-chevron-left" style={{ fontSize:18 }} aria-hidden="true" /> Terug
        </span>
        <span style={{ flex:1, textAlign:'center', fontSize:15, fontWeight:500, color:'var(--text)', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
          {!editing && <i className="ti ti-clipboard-plus" style={{ fontSize:17, color:'var(--accent)' }} aria-hidden="true" />}
          {editing ? 'Bewerken' : 'Nieuwe taak'}
        </span>
        <span onClick={handleSave} style={{ width:48, display:'flex', justifyContent:'flex-end', cursor:'pointer' }}>
          <i className={saving ? 'ti ti-loader' : 'ti ti-check'} style={{ fontSize:20, color:'var(--accent)' }} aria-hidden="true" />
        </span>
      </div>

      <div style={{ flex:1, overflowY:'auto', background:'var(--bg)' }}>

        {/* Foto + Titel zij aan zij bovenaan */}
        <input ref={fileRef} type="file" accept="image/*" capture="environment"
          style={{ display:'none' }} onChange={handlePhotoChange} />
        <div style={{ display:'flex', gap:12, padding:'16px 16px 12px', alignItems:'flex-start' }}>
          <div onClick={() => fileRef.current.click()} style={{
            width:72, height:72, flexShrink:0, borderRadius:10, overflow:'hidden',
            border:'1.5px dashed var(--border)', background:'var(--bg-secondary)',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            gap:4, cursor:'pointer',
          }}>
            {photoPreview
              ? <img src={photoPreview} alt="foto" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : <>
                  <i className="ti ti-camera" style={{ fontSize:22, color:'var(--text-faint)' }} aria-hidden="true" />
                  <span style={{ fontSize:9, color:'var(--text-faint)' }}>Foto</span>
                </>
            }
          </div>
          <div style={{ flex:1, paddingTop:2 }}>
            <label style={{ display:'block', fontSize:12, color:'var(--text-muted)', marginBottom:5 }}>Wat moet er gebeuren?</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="bijv. Wasmachine uitruimen"
              style={{ width:'100%', background:'var(--bg-secondary)', border:'0.5px solid var(--border)', borderRadius:8, padding:'10px 12px', fontSize:14, color:'var(--text)', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
          </div>
        </div>

        {/* Herhaling */}
        <div style={{ padding:'0 16px 12px' }}>
          <label style={{ display:'block', fontSize:12, color:'var(--text-muted)', marginBottom:5 }}>Herhaling</label>
          <Chips opts={REPEAT} value={repeat} onSelect={handleRepeat} />
        </div>

        {/* Wanneer — alleen bij Eenmalig */}
        {repeat === 'Eenmalig' && (
          <div style={{ padding:'0 16px 12px' }}>
            <label style={{ display:'block', fontSize:12, color:'var(--text-muted)', marginBottom:5 }}>Wanneer?</label>
            <Chips opts={HORIZONS} value={horizon} onSelect={setHorizon} />
            {horizon === 'Vandaag' && (
              <div style={{ marginTop:8 }}>
                <Chips opts={TIMES} value={timeOfDay} onSelect={setTimeOfDay} small />
              </div>
            )}
          </div>
        )}

        {/* Dag van de week — alleen bij Wekelijks */}
        {repeat === 'Wekelijks' && (
          <div style={{ padding:'0 16px 12px' }}>
            <label style={{ display:'block', fontSize:12, color:'var(--text-muted)', marginBottom:5 }}>Op welke dag?</label>
            <div style={{ display:'flex', gap:6 }}>
              {DAYS.map((d, i) => (
                <div key={i} onClick={() => setDayOfWeek(dayOfWeek === i ? null : i)} style={{
                  width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:12, cursor:'pointer', flexShrink:0,
                  border: dayOfWeek === i ? 'none' : '0.5px solid var(--border)',
                  background: dayOfWeek === i ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                  color: dayOfWeek === i ? 'var(--accent-text)' : 'var(--text-muted)',
                }}>
                  {d}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prioriteit */}
        <div style={{ padding:'0 16px 12px' }}>
          <label style={{ display:'block', fontSize:12, color:'var(--text-muted)', marginBottom:5 }}>Prioriteit</label>
          <Chips opts={PRIO} value={prio} onSelect={setPrio} />
        </div>

        {/* Foutmelding */}
        {error && (
          <div style={{ margin:'0 16px 12px', padding:'10px 14px', background:'var(--danger-bg)', color:'var(--danger)', borderRadius:8, fontSize:13 }}>
            {error}
          </div>
        )}

        {/* Verwijderen */}
        {editing && (
          <div style={{ padding:'8px 16px 16px' }}>
            <button onClick={handleDelete} disabled={saving} style={{ width:'100%', padding:12, borderRadius:10, border:'0.5px solid var(--danger)', background:'var(--danger-bg)', color:'var(--danger)', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
              <i className="ti ti-trash" aria-hidden="true" /> Verwijderen
            </button>
          </div>
        )}
      </div>

      {/* Opslaan */}
      <div style={{ padding:'8px 16px 16px', background:'var(--bg)', borderTop:'0.5px solid var(--border)' }}>
        <button onClick={handleSave} disabled={saving} style={{
          width:'100%', padding:13, borderRadius:10, border:'none',
          background:'var(--accent)', color:'#fff', fontSize:15, fontWeight:500, cursor:'pointer', fontFamily:'inherit',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          opacity: saving ? 0.6 : 1,
        }}>
          <i className={saving ? 'ti ti-loader' : 'ti ti-plus'} aria-hidden="true" />
          {saving ? 'Opslaan...' : editing ? 'Wijzigingen opslaan' : 'Taak toevoegen'}
        </button>
      </div>
    </div>
  )
}
