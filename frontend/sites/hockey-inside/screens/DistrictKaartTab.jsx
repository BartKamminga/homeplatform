import { useState, useEffect } from 'react'
import { api } from '@core/api.js'

const SEASONS = ['2024-2025', '2025-2026', '2026-2027']

const DISTRICTS = {
  'Noord Nederland':  { color: '#4EAAC8', cx: 312, cy: 96  },
  'Noord-Holland':    { color: '#E8A838', cx: 116, cy: 110 },
  'Midden Nederland': { color: '#49AF7C', cx: 192, cy: 178 },
  'Zuid-Holland':     { color: '#D04F4F', cx: 104, cy: 240 },
  'Oost Nederland':   { color: '#9475CF', cx: 302, cy: 228 },
  'Zuid Nederland':   { color: '#E07B3A', cx: 200, cy: 372 },
}

// Province → district (Zeeland = Zuid Nederland per KNHB)
const P2D = {
  Groningen: 'Noord Nederland', Friesland: 'Noord Nederland', Drenthe: 'Noord Nederland',
  'Noord-Holland': 'Noord-Holland',
  Flevoland: 'Midden Nederland', Utrecht: 'Midden Nederland',
  'Zuid-Holland': 'Zuid-Holland',
  Zeeland: 'Zuid Nederland',
  Overijssel: 'Oost Nederland', Gelderland: 'Oost Nederland',
  'Noord-Brabant': 'Zuid Nederland', Limburg: 'Zuid Nederland',
}

// Simplified province polygons (viewBox 0 0 400 470)
const PROVS = [
  ['Groningen',     '268,75 330,68 385,72 390,120 350,128 300,130 268,128 260,100'],
  ['Friesland',     '155,92 165,50 178,22 222,12 265,18 268,75 260,100 230,108 195,112 155,108'],
  ['Drenthe',       '260,105 268,128 300,130 350,128 390,120 385,188 318,192 265,188 255,158 258,128'],
  ['Overijssel',    '255,190 265,188 318,192 385,188 378,248 318,255 268,250 248,222'],
  ['Flevoland',     '163,142 195,134 215,150 215,185 190,194 163,188'],
  ['Utrecht',       '153,225 158,202 175,190 200,190 215,185 215,212 205,240 180,250 155,246'],
  ['Noord-Holland', '108,192 130,170 148,143 158,110 153,68 138,38 115,28 96,44 88,84 92,132 102,164'],
  ['Zuid-Holland',  '78,258 108,192 132,172 150,183 155,214 153,250 140,272 115,282 88,280 72,264'],
  ['Zeeland',       '46,335 74,296 108,296 115,330 98,356 70,368 46,350'],
  ['Gelderland',    '200,242 248,222 268,250 318,255 325,308 302,322 268,332 230,328 200,312 188,278'],
  ['Noord-Brabant', '78,282 108,282 130,294 148,292 180,285 228,328 268,332 272,372 228,385 182,388 138,375 100,354 74,330'],
  ['Limburg',       '268,332 302,322 328,332 335,392 320,438 298,458 278,432 268,392 272,372'],
]

// Bounding boxes [x, y, w, h] for deterministic club dot placement
const BBOX = {
  'Noord Nederland':  [155, 12, 230, 178],
  'Noord-Holland':    [88,  28, 70,  164],
  'Midden Nederland': [153, 134, 62,  116],
  'Zuid-Holland':     [72,  192, 100, 112],
  'Oost Nederland':   [248, 188, 137, 144],
  'Zuid Nederland':   [46,  282, 292, 188],
}

function hp(key, min, range) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) & 0x7fffffff
  return min + (h % range)
}

// ── SVG map ───────────────────────────────────────────────────────────────────

function NlMap({ selected, onSelect, clubsByDistrict, showPins }) {
  return (
    <svg viewBox="0 0 400 470" style={{ width: '100%', maxWidth: 340 }}>
      {PROVS.map(([id, pts]) => {
        const d = P2D[id]
        const { color } = DISTRICTS[d]
        return (
          <polygon key={id} points={pts} fill={color}
            stroke="var(--color-bg)" strokeWidth="2.5"
            style={{
              cursor: 'pointer',
              filter: selected === d ? `brightness(1.12) drop-shadow(0 0 4px ${color})` : 'none',
              opacity: selected && selected !== d ? 0.18 : 1,
              transition: 'opacity .15s, filter .15s',
            }}
            onClick={() => onSelect(selected === d ? null : d)}
          />
        )
      })}

      {Object.entries(DISTRICTS).map(([name, { cx, cy }]) => (
        <text key={name} x={cx} y={cy} textAnchor="middle" style={{
          fontSize: 7.5, fontWeight: 700, fill: '#fff', pointerEvents: 'none',
          opacity: selected && selected !== name ? 0.08 : 0.9,
          transition: 'opacity .15s', letterSpacing: '.02em',
        }}>
          {name.replace(' Nederland', ' NL')}
        </text>
      ))}

      {showPins && Object.entries(BBOX).map(([dname, [bx, by, bw, bh]]) => {
        const clubs = clubsByDistrict[dname] || []
        const dim = selected && selected !== dname
        return clubs.slice(0, 55).map(c => (
          <circle key={c.external_id}
            cx={hp(c.external_id + 'x', bx + 4, bw - 8)}
            cy={hp(c.external_id + 'y', by + 4, bh - 8)}
            r={3} fill="#fff" stroke={DISTRICTS[dname].color} strokeWidth="1.2"
            style={{ opacity: dim ? 0.06 : 0.85, transition: 'opacity .15s' }}>
            <title>{c.friendly_name || c.name}</title>
          </circle>
        ))
      })}

      {(clubsByDistrict['_none']?.length ?? 0) > 0 && (
        <g style={{ opacity: selected ? 0.22 : 1, transition: 'opacity .15s', pointerEvents: 'none' }}>
          <circle cx={195} cy={168} r={16} fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="1.5"/>
          <text x={195} y={164} textAnchor="middle" style={{ fontSize: 6.5, fill: 'var(--color-text-muted)' }}>geen</text>
          <text x={195} y={176} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: 'var(--color-text)' }}>{clubsByDistrict['_none'].length}</text>
        </g>
      )}
    </svg>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ selected, clubsByDistrict, onNavigate }) {
  const d = selected ? DISTRICTS[selected] : null
  const clubs = selected ? (clubsByDistrict[selected] || []) : []

  if (!selected) return (
    <div style={{ padding: '20px 16px', fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
      Klik op een district op de kaart om clubs te zien.
    </div>
  )

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0, display: 'inline-block' }}/>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{selected}</span>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>{clubs.length} clubs</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
        {clubs.sort((a, b) => (a.friendly_name || a.name).localeCompare(b.friendly_name || b.name, 'nl')).map(c => (
          <span key={c.external_id} style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 99,
            background: d.color + '18', color: d.color,
            border: `1px solid ${d.color}40`, fontWeight: 600,
          }}>
            {c.friendly_name || c.name}
          </span>
        ))}
      </div>

      <button onClick={() => onNavigate(selected)} style={{
        marginTop: 'auto', padding: '9px 14px', borderRadius: 8,
        background: 'var(--color-primary)', color: '#fff', border: 'none',
        fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
      }}>
        → Ga naar district view
      </button>
    </div>
  )
}

// ── DistrictKaartTab ──────────────────────────────────────────────────────────

export default function DistrictKaartTab({ onNavigateToDistrict }) {
  const [season,   setSeason]   = useState('2026-2027')
  const [clubs,    setClubs]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState(null)
  const [showPins, setShowPins] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get('/api/hockey/clubs').then(r => setClubs(r.clubs || [])).finally(() => setLoading(false))
  }, [season])

  const clubsByDistrict = {}
  for (const c of clubs) {
    const key = c.district || '_none'
    if (!clubsByDistrict[key]) clubsByDistrict[key] = []
    clubsByDistrict[key].push(c)
  }

  return (
    <div>
      <style>{`
        @media (max-width: 640px) {
          .hk-kaart-body { display: flex !important; grid-template-columns: none !important;
            overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
          .hk-kaart-pane { flex: 0 0 100%; scroll-snap-align: start; border-right: none !important; }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>Seizoen:</span>
        {SEASONS.map(s => (
          <button key={s} onClick={() => setSeason(s)} style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 99, fontFamily: 'inherit', cursor: 'pointer',
            border: `1px solid ${season === s ? 'var(--color-primary)' : 'var(--color-border)'}`,
            background: season === s ? 'var(--color-primary)' : 'var(--color-surface)',
            color: season === s ? '#fff' : 'var(--color-text)',
          }}>{s}</button>
        ))}
        <button onClick={() => setShowPins(v => !v)} style={{
          marginLeft: 'auto', fontSize: 11, padding: '3px 10px', borderRadius: 99,
          fontFamily: 'inherit', cursor: 'pointer',
          border: `1px solid ${showPins ? 'var(--color-primary)' : 'var(--color-border)'}`,
          background: showPins ? 'var(--color-primary)' : 'var(--color-surface)',
          color: showPins ? '#fff' : 'var(--color-text)',
        }}>📍 Clubs tonen</button>
      </div>

      {loading && <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>Laden…</p>}

      <div className="hk-kaart-body" style={{
        display: 'grid', gridTemplateColumns: '1fr 280px',
        border: '1px solid var(--color-border)', borderRadius: 12,
        overflow: 'hidden', background: 'var(--color-surface)',
      }}>
        <div className="hk-kaart-pane" style={{
          padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRight: '1px solid var(--color-border)',
        }}>
          <NlMap selected={selected} onSelect={setSelected} clubsByDistrict={clubsByDistrict} showPins={showPins}/>
        </div>
        <div className="hk-kaart-pane">
          <Sidebar selected={selected} clubsByDistrict={clubsByDistrict}
            onNavigate={() => onNavigateToDistrict?.(selected)}/>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        {Object.entries(DISTRICTS).map(([name, { color }]) => {
          const cnt = clubsByDistrict[name]?.length ?? 0
          const active = selected === name
          return (
            <button key={name} onClick={() => setSelected(active ? null : name)} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
              border: `1px solid ${active ? color : 'var(--color-border)'}`,
              background: active ? color + '22' : 'var(--color-surface)',
              color: active ? color : 'var(--color-text-muted)', fontWeight: active ? 700 : 400,
            }}>
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: color, marginRight: 5, verticalAlign: 'middle' }}/>
              {name} · {cnt}
            </button>
          )
        })}
        {(clubsByDistrict['_none']?.length ?? 0) > 0 && (
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
            Geen district · {clubsByDistrict['_none'].length}
          </span>
        )}
      </div>
    </div>
  )
}
