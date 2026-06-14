import { useState, useEffect } from 'react'
import { getTournaments, updateTournament, deleteTournament, getPools, getTeams, getClubs } from '../api.js'
import TournamentTab         from '../beheer/TournamentTab.jsx'
import PoolsTab              from '../beheer/PoolsTab.jsx'
import TeamsTab              from '../beheer/TeamsTab.jsx'
import FieldsTab             from '../beheer/FieldsTab.jsx'
import MatchesTab            from '../beheer/MatchesTab.jsx'
import FasesTab              from '../beheer/FasesTab.jsx'
import ClubsTab              from '../beheer/ClubsTab.jsx'
import ImportTab             from '../beheer/ImportTab.jsx'
import CreateTournamentPopup from '../beheer/CreateTournamentPopup.jsx'
import { inputStyle, primaryBtn, ghostBtn } from '../beheer/styles.js'

const TABS = ['Toernooi', 'Poules', 'Teams', 'Velden', 'Wedstrijden', 'Fases', 'Clubs', 'Importeer']

export default function BeheerPage({ isAdmin, onStageChange }) {
  const [tab,        setTab]        = useState('Toernooi')
  const [tid,        setTid]        = useState(null)
  const [list,       setList]       = useState([])
  const [pools,      setPools]      = useState([])
  const [teams,      setTeams]      = useState([])
  const [clubs,      setClubs]      = useState([])
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    loadAll()
    getClubs().then(setClubs).catch(() => {})
  }, [])

  useEffect(() => {
    if (!tid) { setPools([]); setTeams([]); return }
    getPools(tid).then(setPools).catch(() => {})
    getTeams(tid).then(setTeams).catch(() => {})
  }, [tid])

  async function loadAll() {
    const l = await getTournaments().catch(() => [])
    setList(l)
    if (!tid) {
      const act = l.find(t => t.status === 'active') ?? l[0] ?? null
      if (act) setTid(act.id)
    }
    if (onStageChange) onStageChange()
  }

  async function loadPools() { if (tid) getPools(tid).then(setPools).catch(() => {}) }
  async function loadTeams() { if (tid) getTeams(tid).then(setTeams).catch(() => {}) }
  async function loadClubs() { getClubs().then(setClubs).catch(() => {}) }

  async function activate(id) {
    await updateTournament(id, { status: 'active' })
    await loadAll()
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Toernooi "${name}" verwijderen?\nAlle teams, velden, wedstrijden en poules worden ook verwijderd.`)) return
    await deleteTournament(id)
    if (tid === id) setTid(null)
    await loadAll()
  }

  const active = list.find(t => t.id === tid) ?? null
  const stage  = active?.stage ?? null

  return (
    <div style={{ padding: '16px' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Beheer</h1>

      {/* Toernooikiezer */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <select value={tid ?? ''} onChange={e => setTid(e.target.value || null)}
          style={{ ...inputStyle, flex: 1, fontWeight: 600 }}>
          {list.length === 0 && <option value="">Geen toernooien</option>}
          {list.map(t => {
            const badge = t.stage === 'inregel' ? '🔵' : t.stage === 'test' ? '🟡' : '🟢'
            const act   = t.status === 'active' ? ' ✓' : ''
            return <option key={t.id} value={t.id}>{badge} {t.name}{act} — {t.stage}</option>
          })}
        </select>
        {active && active.status !== 'active' && (
          <button onClick={() => activate(tid)} style={{ ...ghostBtn, whiteSpace: 'nowrap' }}>Activeer</button>
        )}
        {active && (
          <button onClick={() => handleDelete(tid, active.name)}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-danger)',
              background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
            title="Verwijder toernooi">✕</button>
        )}
        <button onClick={() => setShowCreate(true)}
          style={{ ...primaryBtn, whiteSpace: 'nowrap', padding: '8px 14px' }}>+ Nieuw</button>
      </div>

      {showCreate && (
        <CreateTournamentPopup
          onClose={() => setShowCreate(false)}
          onCreated={async () => { setShowCreate(false); await loadAll() }}
        />
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 14px', fontSize: 12, fontWeight: tab === t ? 600 : 400,
            borderRadius: 20, fontFamily: 'inherit', cursor: 'pointer',
            border: `1px solid ${tab === t ? 'var(--color-primary)' : 'var(--color-border)'}`,
            background: tab === t ? 'var(--color-primary)' : 'var(--color-surface)',
            color: tab === t ? '#fff' : 'var(--color-text)',
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Toernooi'    && <TournamentTab active={active} clubs={clubs} onRefresh={loadAll} onSelect={setTid} />}
      {tab === 'Poules'      && <PoolsTab      tid={tid} active={active} pools={pools} teams={teams} stage={stage} loadPools={loadPools} loadTeams={loadTeams} onRefresh={loadAll} />}
      {tab === 'Teams'       && <TeamsTab      tid={tid} pools={pools} teams={teams} clubs={clubs} stage={stage} loadTeams={loadTeams} />}
      {tab === 'Velden'      && <FieldsTab     tid={tid} clubs={clubs} stage={stage} />}
      {tab === 'Wedstrijden' && <MatchesTab    tid={tid} tournament={active} pools={pools} teams={teams} stage={stage} />}
      {tab === 'Fases'       && <FasesTab      tid={tid} stage={stage} />}
      {tab === 'Clubs'       && <ClubsTab      clubs={clubs} onRefresh={loadClubs} />}
      {tab === 'Importeer'   && <ImportTab     onImported={loadAll} />}
    </div>
  )
}
