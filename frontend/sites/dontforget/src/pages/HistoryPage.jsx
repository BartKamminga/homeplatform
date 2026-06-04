import TopBar from '../components/TopBar.jsx'

const HISTORY = [
  { id:1, title:'Koffie gezet',          time:'08:14', person:'Bart', day:'Vandaag' },
  { id:2, title:'Vaatwasser ingeruimd',  time:'12:32', person:'Bart', day:'Vandaag' },
  { id:3, title:'Boodschappen gedaan',   time:'15:10', person:'Bart', day:'Gisteren' },
  { id:4, title:'Wasmachine uitgeruimd', time:'10:05', person:'Bart', day:'Gisteren' },
]

const groups = [...new Set(HISTORY.map(h => h.day))]

export default function HistoryPage() {
  return (
    <div>
      <TopBar title="Geschiedenis" />
      {groups.map(day => (
        <div key={day}>
          <div style={{ padding:'12px 16px 4px', fontSize:11, fontWeight:500, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--text-faint)' }}>
            {day}
          </div>
          {HISTORY.filter(h => h.day === day).map(h => (
            <div key={h.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', borderBottom:'0.5px solid var(--border)' }}>
              <div style={{ width:20, height:20, borderRadius:'50%', background:'var(--done)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className="ti ti-check" style={{ fontSize:12, color:'#fff' }} aria-hidden="true" />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, color:'var(--text)' }}>{h.title}</div>
                <div style={{ fontSize:11, color:'var(--text-faint)', marginTop:1 }}>{h.time} · {h.person}</div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
