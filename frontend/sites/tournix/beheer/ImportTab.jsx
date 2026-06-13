import { useState } from 'react'
import { importTournament } from '../api.js'
import { primaryBtn, ghostBtn } from './styles.js'

// ── Datavanger bestanden ────────────────────────────────────────────────────
const GH_BASE  = 'https://bartkamminga.github.io/nk-hockey/data'
const GH_REPO  = 'https://github.com/bartkamminga/nk-hockey'

const DV_FILES = [
  { key: 'mo14', label: 'MO14', sub: 'Super (5 poules)',      url: `${GH_BASE}/mo14.json`, type: 'o14' },
  { key: 'jo14', label: 'JO14', sub: 'Super (5 poules)',      url: `${GH_BASE}/jo14.json`, type: 'o14' },
  { key: 'mo16', label: 'MO16', sub: 'Landelijk (4 poules)', url: `${GH_BASE}/mo16.json`, type: 'o16' },
  { key: 'jo16', label: 'JO16', sub: 'Landelijk (4 poules)', url: `${GH_BASE}/jo16.json`, type: 'o16' },
]

// ── Parsers (porteer van nkhockey/dataloader/parsers.js) ───────────────────
const clean14 = n => n.replace(/ [A-Z]?O?\d+-\d+/g, '').trim()
const clean16 = n => n.replace(/ [MJ]O\d+-\d+/g, '').trim()
const LETTERS_14 = ['A', 'B', 'C', 'D', 'E']
const LETTERS_16 = ['A', 'B', 'C', 'D']

function buildTournix(pouleMap, letters, name) {
  const pools = [], matches = []
  for (const letter of letters) {
    const p = pouleMap[letter]
    if (!p) continue
    const poolName = p.poolName || `Poule ${letter}`
    pools.push({ name: poolName, teams: p.teams.map(t => ({ name: t, club: t })) })
    for (const m of (p.played || [])) {
      let time = null
      if (m.date) {
        try {
          const d = new Date(m.date)
          if (!isNaN(d)) time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
        } catch {}
      }
      matches.push({ pool: poolName, team_a: m.home, team_b: m.away, time, round: m.round ?? null, match_type: 'pool', status: 'finished', score_a: m.score_a ?? null, score_b: m.score_b ?? null })
    }
    for (const m of p.remaining) {
      let time = null
      if (m.date) {
        try {
          const d = new Date(m.date)
          if (!isNaN(d)) time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
        } catch {}
      }
      matches.push({ pool: poolName, team_a: m.home, team_b: m.away, time, round: m.round ?? null, match_type: 'pool' })
    }
  }
  // Toernooidatum afleiden van eerste wedstrijd met datum
  let date = null
  for (const p of Object.values(pouleMap)) {
    for (const m of [...(p.played || []), ...p.remaining]) {
      if (m.date) {
        try { date = new Date(m.date).toISOString().slice(0, 10) } catch {}
        break
      }
    }
    if (date) break
  }
  return { name, date, location_club: null, pool_type: 'half', pools, fields: [], matches }
}

function parseO14ToTournix(raw, fallbackName) {
  const data = JSON.parse(raw)
  const pouleMap = {}
  let compName = fallbackName

  for (const val of Object.values(data)) {
    if (!val?.data?.data?.poule) continue
    const p  = val.data.data.poule
    const c  = val.competition || p.competition?.name || ''
    const cl = val.class_name  || p.competition?.class_name || ''
    if (!c.includes('O14') || cl !== 'Super') continue
    const letter = (p.name || '').replace('Poule ', '')
    if (!LETTERS_14.includes(letter) || pouleMap[letter]) continue
    if (!compName) compName = `NK Hockey ${c.includes('Jongens') ? 'JO14' : 'MO14'}`
    const st = p.standings || [], ma = p.matches || []
    pouleMap[letter] = {
      poolName: p.name,
      teams: st.map(s => clean14(s.team.name)),
      played: ma
        .filter(m => m.status === 'final')
        .map(m => ({ home: clean14(m.home.name), away: clean14(m.away.name), date: m.date || null, round: m.round ?? null, score_a: m.score?.home ?? null, score_b: m.score?.away ?? null })),
      remaining: ma
        .filter(m => m.status === 'scheduled' || m.status === 'announced')
        .map(m => ({ home: clean14(m.home.name), away: clean14(m.away.name), date: m.date || null, round: m.round ?? null })),
    }
  }
  return Object.keys(pouleMap).length ? buildTournix(pouleMap, LETTERS_14, compName) : null
}

function parseO16ToTournix(raw, fallbackName) {
  const data = JSON.parse(raw)
  let root = null
  let compName = fallbackName

  for (const val of Object.values(data)) {
    if (val?.data?.data?.poules) { root = val.data.data; break }
    if (val?.data?.poules)       { root = val.data;      break }
  }
  if (!root) return null
  if (root.name) compName = compName || `NK Hockey ${root.name.includes('Jongens') ? 'JO16' : 'MO16'}`

  const pouleMap = {}
  for (const p of (root.poules || [])) {
    const cl = p.competition?.class_name || ''
    if (cl !== 'Landelijk') continue
    const letter = (p.name || '').replace('Poule ', '')
    if (!LETTERS_16.includes(letter)) continue
    const st = p.standings || [], ma = p.matches || []
    pouleMap[letter] = {
      poolName: p.name,
      teams: st.map(s => clean16(s.team.name)),
      played: ma
        .filter(m => m.status === 'final')
        .map(m => ({ home: clean16(m.home.name), away: clean16(m.away.name), date: m.date || null, round: m.round ?? null, score_a: m.score?.home ?? null, score_b: m.score?.away ?? null })),
      remaining: ma
        .filter(m => m.status === 'scheduled' || m.status === 'announced')
        .map(m => ({ home: clean16(m.home.name), away: clean16(m.away.name), date: m.date || null, round: m.round ?? null })),
    }
  }
  return Object.keys(pouleMap).length ? buildTournix(pouleMap, LETTERS_16, compName) : null
}

// ── Sample JSON ─────────────────────────────────────────────────────────────
const SAMPLE = {
  name: "NK Hockey MO14 2026",
  date: "2026-06-15",
  location_club: "HC Kampong",
  pool_type: "half",
  pools: [
    { name: "Poule A", teams: [
        { name: "Kampong MO14-1", club: "HC Kampong" },
        { name: "Hurley MO14-1",  club: "Hurley" },
        { name: "Amsterdam MO14-1", club: "Amsterdam HC" },
    ]},
    { name: "Poule B", teams: [
        { name: "SCHC MO14-1", club: "SCHC" },
        { name: "MOP MO14-1",  club: "MOP" },
    ]},
  ],
  fields:  [{ name: "Veld 1", club: "HC Kampong" }, { name: "Veld 2", club: "HC Kampong" }],
  matches: [
    { pool: "Poule A", round: 1, team_a: "Kampong MO14-1",   team_b: "Hurley MO14-1",    field: "Veld 1", time: "09:00" },
    { pool: "Poule B", round: 1, team_a: "SCHC MO14-1",      team_b: "MOP MO14-1",        field: "Veld 2", time: "09:00" },
    { pool: "Poule A", round: 1, team_a: "Amsterdam MO14-1", team_b: "SCHC MO14-1",       field: "Veld 1", time: "10:00" },
  ],
}

// ── Preview component ────────────────────────────────────────────────────────
function Preview({ data }) {
  const teams = (data.pools ?? []).reduce((n, p) => n + (p.teams ?? []).length, 0)
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{data.name ?? '—'}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3px 14px', color: 'var(--color-text-muted)', fontSize: 12 }}>
        {data.date          && <span>📅 {data.date}</span>}
        {data.location_club && <span>📍 {data.location_club}</span>}
        <span>🏷 {(data.pools ?? []).length} poules</span>
        <span>👥 {teams} teams</span>
        <span>🏑 {(data.fields ?? []).length} velden</span>
        <span>⚽ {(data.matches ?? []).length} wedstrijden</span>
      </div>
      {(data.pools ?? []).length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {data.pools.map(p => (
            <span key={p.name} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10,
              background: 'var(--color-primary)', color: '#fff', fontWeight: 500 }}>
              {p.name} ({(p.teams ?? []).length})
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Hoofdcomponent ───────────────────────────────────────────────────────────
export default function ImportTab({ onImported }) {
  const [dvLoading, setDvLoading] = useState(null)
  const [dvError,   setDvError]   = useState('')

  const [json,     setJson]     = useState('')
  const [preview,  setPreview]  = useState(null)
  const [parseErr, setParseErr] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState('')

  // ── Datavanger ophalen ─────────────────────────────────────────────────────
  async function fetchFromDv(file) {
    setDvLoading(file.key); setDvError(''); setPreview(null); setResult(null); setParseErr(''); setError('')
    try {
      const res = await fetch(file.url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = await res.text()
      const tournix = file.type === 'o14' ? parseO14ToTournix(raw, `NK Hockey ${file.label}`) : parseO16ToTournix(raw, `NK Hockey ${file.label}`)
      if (!tournix) throw new Error('Geen bruikbare data gevonden in dit bestand')
      setJson(JSON.stringify(tournix, null, 2))
      setPreview(tournix)
    } catch (e) {
      setDvError(e.message ?? 'Ophaalfout')
    } finally {
      setDvLoading(null)
    }
  }

  // ── JSON handmatig ─────────────────────────────────────────────────────────
  function handleCheck() {
    setResult(null); setError('')
    try {
      const data = JSON.parse(json)
      setParseErr(''); setPreview(data)
    } catch (e) {
      setParseErr(e.message); setPreview(null)
    }
  }

  function loadSample() {
    setJson(JSON.stringify(SAMPLE, null, 2))
    setPreview(null); setParseErr(''); setResult(null); setError('')
  }

  async function handleImport() {
    let data
    try { data = JSON.parse(json) } catch (e) { setParseErr(e.message); return }
    setLoading(true); setError('')
    try {
      const res = await importTournament(data)
      setResult(res); setJson(''); setPreview(null)
      if (onImported) onImported()
    } catch (e) {
      setError(e.message ?? 'Fout bij importeren')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Datavanger ── */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Hockey.nl datavanger</span>
          <a href={GH_REPO} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, color: 'var(--color-text-muted)', textDecoration: 'none', opacity: 0.7 }}>
            ↗ {GH_REPO.replace('https://github.com/', '')}
          </a>
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
          Haal de meest recente data op uit de GitHub repo. Teams, poules, geplande én gespeelde wedstrijden (met uitslag) worden automatisch omgezet.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {DV_FILES.map(f => (
            <button
              key={f.key}
              onClick={() => fetchFromDv(f)}
              disabled={dvLoading !== null}
              style={{
                padding: '10px 14px', borderRadius: 10, cursor: dvLoading ? 'wait' : 'pointer',
                border: '1px solid var(--color-border)', background: dvLoading === f.key ? 'var(--color-primary)' : 'var(--color-background)',
                color: dvLoading === f.key ? '#fff' : 'var(--color-text)', fontFamily: 'inherit',
                textAlign: 'left', opacity: dvLoading !== null && dvLoading !== f.key ? 0.5 : 1,
                transition: 'background 0.15s',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13 }}>
                {dvLoading === f.key ? 'Ophalen…' : f.label}
              </div>
              <div style={{ fontSize: 11, color: dvLoading === f.key ? 'rgba(255,255,255,0.8)' : 'var(--color-text-muted)', marginTop: 2 }}>{f.sub}</div>
            </button>
          ))}
        </div>

        {dvError && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-danger)' }}>⚠ {dvError}</div>
        )}
      </div>

      {/* ── Preview na datavanger ophaal ── */}
      {preview && !result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>VOORBEELD</div>
          <Preview data={preview} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleImport} disabled={loading} style={{ ...primaryBtn }}>
              {loading ? 'Importeren…' : '↑ Importeer toernooi'}
            </button>
            <button onClick={() => { setPreview(null); setJson('') }} style={ghostBtn}>Annuleer</button>
          </div>
        </div>
      )}

      {/* ── Resultaat ── */}
      {result && (
        <div style={{ padding: '14px 16px', background: 'var(--color-success)', color: '#fff', borderRadius: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>✓ Geïmporteerd</div>
          <div style={{ fontSize: 13 }}>{result.name}</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 3 }}>
            {result.pools} poules · {result.teams} teams · {result.fields} velden · {result.matches} wedstrijden
          </div>
          <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>
            Staat in inregel-fase. Selecteer het toernooi via de keuzelijst bovenaan.
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div style={{ padding: '10px 14px', background: 'var(--color-danger)', color: '#fff', borderRadius: 8, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── Handmatig JSON ── */}
      <details open={!preview && !result}>
        <summary style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--color-text-muted)', userSelect: 'none', padding: '4px 0' }}>
          Handmatig JSON importeren
        </summary>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={loadSample} style={{ ...ghostBtn, fontSize: 11, padding: '4px 10px' }}>
              Voorbeeld laden
            </button>
          </div>
          <textarea
            value={json}
            onChange={e => { setJson(e.target.value); setPreview(null); setParseErr(''); setResult(null) }}
            placeholder={'{\n  "name": "NK Hockey MO14 2026",\n  "date": "2026-06-15",\n  ...\n}'}
            spellCheck={false}
            style={{
              width: '100%', minHeight: 220, padding: '10px', borderRadius: 8, resize: 'vertical',
              border: `1px solid ${parseErr ? 'var(--color-danger)' : 'var(--color-border)'}`,
              background: 'var(--color-background)', color: 'var(--color-text)',
              fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5, boxSizing: 'border-box',
            }}
          />
          {parseErr && <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>⚠ {parseErr}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCheck} disabled={!json.trim()} style={ghostBtn}>Controleer</button>
          </div>

          {preview && !result && json && (
            <>
              <Preview data={preview} />
              <button onClick={handleImport} disabled={loading} style={{ ...primaryBtn, alignSelf: 'flex-start' }}>
                {loading ? 'Importeren…' : '↑ Importeer toernooi'}
              </button>
            </>
          )}
        </div>
      </details>

      {/* ── Formaat referentie ── */}
      <details>
        <summary style={{ fontSize: 12, cursor: 'pointer', color: 'var(--color-text-muted)', fontWeight: 600, padding: '4px 0' }}>
          JSON formaat referentie
        </summary>
        <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--color-surface)', borderRadius: 8,
          fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
{`{
  "name":          string (verplicht)
  "date":          "YYYY-MM-DD"
  "location_club": naam van een bestaande club
  "pool_type":     "half" | "vol"  (standaard: "half")

  "pools": [
    { "name": "Poule A",
      "teams": [{ "name": "Naam", "club": "Clubnaam" }] }
  ],
  "fields":  [{ "name": "Veld 1", "club": "Clubnaam" }],
  "matches": [
    { "team_a": "Naam", "team_b": "Naam",
      "pool": "Poule A", "round": 1,
      "field": "Veld 1", "time": "HH:MM",
      "match_type": "pool",
      "status": "scheduled" | "finished",
      "score_a": 3, "score_b": 1 }
  ]
}`}
        </div>
      </details>
    </div>
  )
}
