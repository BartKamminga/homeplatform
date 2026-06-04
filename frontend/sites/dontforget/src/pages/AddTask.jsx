import { useState } from 'react'

const WHEN    = ['Vandaag','Vanavond','Morgen','Deze week']
const REPEAT  = ['Eenmalig','Dagelijks','Wekelijks','Maandelijks']
const PRIO    = ['Hoog','Normaal','Laag']

export default function AddTask({ onClose, task }) {
  const [title,  setTitle]  = useState(task?.title || '')
  const [when,   setWhen]   = useState(task?.when || 'Vandaag')
  const [repeat, setRepeat] = useState(task?.repeat || 'Eenmalig')
  const [prio,   setPrio]   = useState(task?.priority || 'Normaal')
  const [photo,  setPhoto]  = useState(false)

  const editing = !!task

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ display:'flex', alignItems:'center', padding:'14px 16px', borderBottom:'0.5px solid var(--border)', background:'var(--bg-card)' }}>
        <span onClick={onClose} style={{ fontSize:13, color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
          <i className="ti ti-chevron-left" style={{ fontSize:18 }} aria-hidden="true" /> Terug
        </span>
        <span style={{ flex:1, textAlign:'center', fontSize:15, fontWeight:500, color:'var(--text)' }}>
          {editing ? 'Bewerken' : 'Nieuwe taak'}
        </span>
        <span style={{ fontSize:13, fontWeight:500, color:'var(--accent)', cursor:'pointer' }}>Opslaan</span>
      </div>

      <div style={{ flex:1, overflowY:'auto', background:'var(--bg)' }}>
        <div onClick={() => setPhoto(true)} style={{
          margin:16, border:`1.5px dashed var(--border)`, borderRadius:12,
          padding:'20px 16px', display:'flex', flexDirection:'column', alignItems:'center', gap:8,
          cursor:'pointer', background:'var(--bg-secondary)',
        }}>
          {photo
            ? <><i className="ti ti-check" style={{ fontSize:28, color:'var(--done)' }} aria-hidden="true" /><span style={{ fontSize:13, color:'var(--text-muted)' }}>Foto toegevoegd</span></>
            : <><i className="ti ti-camera" style={{ fontSize:28, color:'var(--text-faint)' }} aria-hidden="true" /><span style={{ fontSize:13, color:'var(--text-muted)' }}>Foto toevoegen</span><span style={{ fontSize:11, color:'var(--text-faint)' }}>Tik om te fotograferen of uploaden</span></>
          }
        </div>

        <div style={{ padding:'0 16px 12px' }}>
          <label style={{ display:'block', fontSize:12, color:'var(--text-muted)', marginBottom:5 }}>Wat moet er gebeuren?</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="bijv. Wasmachine uitruimen"
            style={{ width:'100%', background:'var(--bg-secondary)', border:'0.5px solid var(--border)', borderRadius:8, padding:'10px 12px', fontSize:14, color:'var(--text)', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
        </div>

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

        {editing && (
          <div style={{ padding:'8px 16px 16px' }}>
            <button style={{ width:'100%', padding:12, borderRadius:10, border:'0.5px solid var(--danger)', background:'var(--danger-bg)', color:'var(--danger)', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
              <i className="ti ti-trash" aria-hidden="true" /> Verwijderen
            </button>
          </div>
        )}
      </div>

      <div style={{ padding:'8px 16px 16px', background:'var(--bg)', borderTop:'0.5px solid var(--border)' }}>
        <button onClick={onClose} style={{
          width:'100%', padding:13, borderRadius:10, border:'none',
          background:'var(--accent)', color:'#fff', fontSize:15, fontWeight:500, cursor:'pointer', fontFamily:'inherit',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
        }}>
          <i className="ti ti-plus" aria-hidden="true" />
          {editing ? 'Wijzigingen opslaan' : 'Taak toevoegen'}
        </button>
      </div>
    </div>
  )
}
