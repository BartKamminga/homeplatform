import { useTaskForm, REPEAT, HORIZONS, TIMES, PRIO, DAYS } from '../hooks/useTaskForm.js'

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
  const {
    editing,
    repeat, setRepeat,
    horizon, setHorizon,
    timeOfDay, setTimeOfDay,
    dayOfWeek, setDayOfWeek,
    prio, setPrio,
    title, setTitle,
    photoPreview, fileRef,
    saving, error,
    handlePhotoChange, handleSave, handleDelete,
  } = useTaskForm(task, { onSaved, onClose })

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

        {/* Foto + Titel */}
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
          <Chips opts={REPEAT} value={repeat} onSelect={setRepeat} />
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
