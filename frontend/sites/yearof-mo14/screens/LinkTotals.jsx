import { SECTIONS } from './LinkOverview.jsx'

// Totalen bovenaan de Linkjes-tab (item 1193): per soort link en overall.
// Uniek komt uit de backend (over de ruwe bezoeken), want 1 apparaat opent
// vaak meerdere links - optellen per rij zou dubbel tellen.
function Tile({ label, t, strong = false }) {
  return (
    <div style={{
      flex: '1 1 110px', padding: '10px 12px', borderRadius: 10,
      background: strong ? '#12203c' : '#f4f6fb', color: strong ? '#fff' : 'inherit',
    }}>
      <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>
        {t.opens}
        {t.admin_opens > 0 && <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.7 }}> ({t.admin_opens})</span>}
      </div>
      <div style={{ fontSize: 11, opacity: 0.75 }}>{t.unique} uniek</div>
    </div>
  )
}

export default function LinkTotals({ totals }) {
  if (!totals) return null
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
      <Tile label="Totaal geopend" t={totals.all} strong />
      {SECTIONS.map(s => totals[s.key] && <Tile key={s.key} label={s.title} t={totals[s.key]} />)}
    </div>
  )
}
