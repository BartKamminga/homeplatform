import TopBar from '../components/TopBar.jsx'

const ROUTINES = [
  { id:1, title:'Koffie zetten',       repeat:'Dagelijks', when:'Ochtend' },
  { id:2, title:'Vaatwasser inruimen', repeat:'Dagelijks', when:'Middag' },
  { id:3, title:'Wasmachine uitruimen',repeat:'Wekelijks', when:'Maandag · Ochtend' },
  { id:4, title:'Prullenbak buiten',   repeat:'Wekelijks', when:'Vrijdag · Avond' },
]

export default function RoutinesPage({ onAdd }) {
  return (
    <div>
      <TopBar title="Routines" onAdd={onAdd} />
      <div style={{ padding:'12px 16px 4px', fontSize:11, fontWeight:500, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--text-faint)' }}>
        Terugkerend
      </div>
      {ROUTINES.map(r => (
        <div key={r.id} style={{
          display:'flex', alignItems:'center', gap:10, padding:'12px 16px',
          borderBottom:'0.5px solid var(--border)', cursor:'pointer',
        }}>
          <div style={{ width:36, height:36, borderRadius:8, background:'var(--accent-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <i className="ti ti-repeat" style={{ fontSize:16, color:'var(--accent-text)' }} aria-hidden="true" />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, color:'var(--text)' }}>{r.title}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{r.repeat} · {r.when}</div>
          </div>
          <i className="ti ti-chevron-right" style={{ fontSize:16, color:'var(--text-faint)' }} aria-hidden="true" />
        </div>
      ))}
    </div>
  )
}
