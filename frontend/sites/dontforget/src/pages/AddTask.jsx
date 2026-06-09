import { useState, useRef } from 'react'
import { api } from '@core/api.js'

import { uploadPhoto, createTask, updateTask, deleteTask } from '../api.js'

const WHEN   = ['Vandaag', 'Vanavond', 'Morgen', 'Deze week']
const REPEAT = ['Eenmalig', 'Dagelijks', 'Wekelijks', 'Maandelijks']
const PRIO   = ['Hoog', 'Normaal', 'Laag']

const WHEN_MAP   = { 'Vandaag': 'morning', 'Vanavond': 'evening', 'Morgen': 'morning', 'Deze week': 'week' }
const REPEAT_MAP = { 'Eenmalig': 'once', 'Dagelijks': 'daily', 'Wekelijks': 'weekly', 'Maandelijks': 'monthly' }
const PRIO_MAP   = { 'Hoog': 'high', 'Normaal': 'normal', 'Laag': 'low' }



export default function AddTask({ onClose, task, onSaved }) {
  const [title,     setTitle]     = useState(task?.title || '')
  const [when,      setWhen]      = useState(task?.when || 'Vandaag')
  const [repeat,    setRepeat]    = useState(task?.repeat || 'Eenmalig')
  const [prio,      setPrio]      = useState(task?.priority || 'Normaal')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(task?.photo_path || null)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState(null)
  const fileRef = useRef()

  const editing = !!task

  function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!title.trim()) { setError('Vul een titel in'); return }
    setSaving(true)
    setError(null)

    try {
      let photo_path = task?.photo_path || null

      // 1. Upload foto als aanwezig
      if (photoFile) {
        const result = await uploadPhoto(photoFile)
        photo_path = result.path
      }

      // 2. Taak aanmaken of bijwerken
      const data = {
        title: title.trim(),
        photo_path,
        when: WHEN_MAP[when],
        repeat: REPEAT_MAP[repeat],
        priority: PRIO_MAP[prio],
      }

      if (editing) {
        await api.patch(`/api/dontforget/tasks/${task.id}`, data)
      } else {
        await api.post('/api/dontforget/tasks', data)
      }

      onSaved?.()
      onClose()
    } catch (e) {
      setError(e.message || 'Er ging iets mis')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing) return
    setSaving(true)
    try {
      await api.delete(`/api/dontforget/tasks/${task.id}`)
      onSaved?.()
      onClose()
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
        <span style={{ flex:1, textAlign:'center', fontSize:15, fontWeight:500, color:'var(--text)' }}>
          {editing ? 'Bewerken' : 'Nieuwe taak'}
        </span>
        <span style={{ width: 48 }} />
      </div>

      <div style={{ flex:1, overflowY:'auto', background:'var(--bg)' }}>

        {/* Foto */}
        <input ref={fileRef} type="file" accept="image/*" capture="environment"
          style={{ display:'none' }} onChange={handlePhotoChange} />
        <div onClick={() => fileRef.current.click()} style={{
          margin:16, border:`1.5px dashed var(--border)`, borderRadius:12,
          padding:'20px 16px', display:'flex', flexDirection:'column', alignItems:'center', gap:8,
          cursor:'pointer', background:'var(--bg-secondary)', overflow:'hidden',
        }}>
          {photoPreview
            ? <img src={photoPreview} alt="foto" style={{ width:'100%', maxHeight:160, objectFit:'cover', borderRadius:8 }} />
            : <>
                <i className="ti ti-camera" style={{ fontSize:28, color:'var(--text-faint)' }} aria-hidden="true" />
                <span style={{ fontSize:13, color:'var(--text-muted)' }}>Foto toevoegen</span>
                <span style={{ fontSize:11, color:'var(--text-faint)' }}>Tik om te fotograferen of uploaden</span>
              </>
          }
        </div>

        {/* Titel */}
        <div style={{ padding:'0 16px 12px' }}>
          <label style={{ display:'block', fontSize:12, color:'var(--text-muted)', marginBottom:5 }}>Wat moet er gebeuren?</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="bijv. Wasmachine uitruimen"
            style={{ width:'100%', background:'var(--bg-secondary)', border:'0.5px solid var(--border)', borderRadius:8, padding:'10px 12px', fontSize:14, color:'var(--text)', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
        </div>

        {/* Wanneer / Herhaling / Prioriteit */}
        {[['Wanneer?', WHEN, when, setWhen], ['Herhaling', REPEAT, repeat, setRepeat], ['Prioriteit', PRIO, prio, setPrio]].map(([label, opts, val, set]) => (
          <div key={label} style={{ padding:'0 16px 12px' }}>
            <label style={{ display:'block', fontSize:12, color:'var(--text-muted)', marginBottom:5 }}>{label}</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {opts.map(o => (
                <div key={o} onClick={() => set(o)} style={{
                  padding:'6px 14px', borderRadius:20, fontSize:12, cursor:'pointer',
                  border: val === o ? 'none' : '0.5px solid var(--border)',
                  background: val === o ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                  color: val === o ? 'var(--accent-text)' : 'var(--text-muted)',
                }}>
                  {o}
                </div>
              ))}
            </div>
          </div>
        ))}

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
