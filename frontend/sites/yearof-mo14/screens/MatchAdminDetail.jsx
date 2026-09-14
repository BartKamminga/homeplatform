import { useState, useEffect } from 'react'
import {
  getTimelineItem, getPlayers,
  getReportsModeration, tagReport, untagReport, createReportDirect, moveReport,
  getPhotosModeration, updatePhoto, deletePhoto, tagPhoto, untagPhoto,
  createContributorLink, listContributorLinks,
  getMatchGoals, setMatchGoal, movePhotoBlock,
} from '../api.js'
import { copyToClipboard } from '../clipboard.js'
import { contributorLinkStatus } from '../linkStatus.js'
import { PhotoCard } from './PhotosAdmin.jsx'
import { ReportForm } from './ReportForm.jsx'
import { defaultInstagramLinks, defaultVideoLinks, NewLinksEditor, ExistingLinksEditor } from './ReportLinks.jsx'
import PublicEntry from './PublicEntry.jsx'

// Kies-scherm - 1 herkenbare ingang vanuit de preview ("+ item toevoegen"),
// die hierna splitst in 4 losse paden. insertAfterId (kan null zijn) wordt
// gewoon doorgegeven aan het gekozen vervolgpad.
function ChooseReportKind({ onWriteMyself, onSendInvite, onAddInstagram, onAddFootage, onBack }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <button onClick={onBack} style={{ fontSize: 12, cursor: 'pointer', marginBottom: 12 }}>&larr; terug</button>
      <h3 style={{ fontSize: 15, margin: '0 0 14px' }}>Hoe wil je dit toevoegen?</h3>
      <div style={{ display: 'grid', gap: 10 }}>
        <button onClick={onWriteMyself} className="yof-card" style={{ textAlign: 'left', cursor: 'pointer', border: 'none' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Zelf schrijven</div>
          <div style={{ fontSize: 13, color: '#666' }}>Jij typt en publiceert het verslag of interview direct.</div>
        </button>
        <button onClick={onSendInvite} className="yof-card" style={{ textAlign: 'left', cursor: 'pointer', border: 'none' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Invullinkje versturen</div>
          <div style={{ fontSize: 13, color: '#666' }}>Stuur een linkje naar een speelster - zij typt het later zelf in.</div>
        </button>
        <button onClick={onAddInstagram} className="yof-card" style={{ textAlign: 'left', cursor: 'pointer', border: 'none' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Instagram-linkje toevoegen</div>
          <div style={{ fontSize: 13, color: '#666' }}>1 Instagram-post, wordt echt ingebed op de pagina.</div>
        </button>
        <button onClick={onAddFootage} className="yof-card" style={{ textAlign: 'left', cursor: 'pointer', border: 'none' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Wedstrijdbeelden toevoegen</div>
          <div style={{ fontSize: 13, color: '#666' }}>Een blokje met (minimaal 4) video-linkjes.</div>
        </button>
      </div>
    </div>
  )
}

function InviteLinkScreen({ matchRef, players, onBack }) {
  const [links, setLinks] = useState([])
  const [playerId, setPlayerId] = useState('')
  const [reportType, setReportType] = useState('wedstrijdverslag')
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState('')

  function load() {
    listContributorLinks().then(rows => setLinks(rows.filter(l => l.match_ref === matchRef))).catch(e => setError(e.message))
  }
  useEffect(load, [matchRef])

  function playerName(id) {
    return players.find(p => p.id === id)?.nickname || players.find(p => p.id === id)?.name || '-'
  }

  async function make() {
    try {
      await createContributorLink({ match_ref: matchRef, player_id: playerId || null, report_type: reportType, expires_days: 14 })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function copy(link) {
    const url = `${window.location.origin}/yearof-mo14/?invul=${link.id}`
    try {
      await copyToClipboard(url)
      setCopiedId(link.id)
      setTimeout(() => setCopiedId(''), 2000)
    } catch (e) {
      setError(e.message)
    }
  }

  function openLink(link) {
    window.open(`${window.location.origin}/yearof-mo14/?invul=${link.id}`, '_blank')
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <button onClick={onBack} style={{ fontSize: 12, cursor: 'pointer', marginBottom: 12 }}>&larr; terug</button>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Invullinkje versturen</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={reportType} onChange={e => setReportType(e.target.value)} style={{ fontSize: 12 }}>
          <option value="wedstrijdverslag">Wedstrijdverslag</option>
          <option value="interview">Interview</option>
        </select>
        <select value={playerId} onChange={e => setPlayerId(e.target.value)} style={{ fontSize: 12 }}>
          <option value="">Voor het hele team / mezelf</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}
        </select>
        <button onClick={make} style={{ fontSize: 12, cursor: 'pointer' }}>Nieuw invullinkje</button>
      </div>

      {links.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#888' }}>
              <th style={{ padding: 6 }}>Speler</th>
              <th style={{ padding: 6 }}>Type</th>
              <th style={{ padding: 6 }}>Status</th>
              <th style={{ padding: 6 }}>Link</th>
              <th style={{ padding: 6 }}></th>
            </tr>
          </thead>
          <tbody>
            {links.map(l => {
              const status = contributorLinkStatus(l)
              const url = `${window.location.origin}/yearof-mo14/?invul=${l.id}`
              return (
                <tr key={l.id} style={{ borderTop: '1px solid #eee' }}>
                  <td style={{ padding: 6 }}>{l.player_id ? playerName(l.player_id) : 'team'}</td>
                  <td style={{ padding: 6 }}>{l.report_type}</td>
                  <td style={{ padding: 6, color: status.color, fontWeight: 600 }}>{status.label}</td>
                  <td style={{ padding: 6, width: 200 }}>
                    <input readOnly value={url} onFocus={e => e.target.select()}
                      style={{ width: '100%', boxSizing: 'border-box', fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid #ddd' }} />
                  </td>
                  <td style={{ padding: 6, display: 'flex', gap: 4 }}>
                    <button onClick={() => copy(l)} style={{ fontSize: 11, cursor: 'pointer' }}>
                      {copiedId === l.id ? 'Gekopieerd!' : 'Kopieer'}
                    </button>
                    <button onClick={() => openLink(l)} style={{ fontSize: 11, cursor: 'pointer' }}>Openen</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

const LINKS_BLOCK_META = {
  instagram: { title: 'Instagram', reportTitle: 'Instagram', defaults: defaultInstagramLinks },
  wedstrijd_beelden: { title: 'Wedstrijdbeelden', reportTitle: 'Wedstrijdbeelden', defaults: defaultVideoLinks },
}

const INVITE_TYPE_LABEL = { wedstrijdverslag: 'Wedstrijdverslag', interview: 'Interview' }

// Focust op 1 specifiek invullinkje (niet de hele lijst) - vanuit de
// placeholder-kaart in de preview, zodat "editen" over dat ene linkje gaat.
function InviteDetailScreen({ link, players, onBack }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  if (!link) {
    return (
      <div style={{ marginBottom: 24 }}>
        <button onClick={onBack} style={{ fontSize: 12, cursor: 'pointer', marginBottom: 12 }}>&larr; terug</button>
        <p style={{ fontSize: 13, color: '#666' }}>Dit invullinkje bestaat niet meer.</p>
      </div>
    )
  }

  const status = contributorLinkStatus(link)
  const url = `${window.location.origin}/yearof-mo14/?invul=${link.id}`
  const forWhom = link.player_id
    ? (players.find(p => p.id === link.player_id)?.nickname || players.find(p => p.id === link.player_id)?.name || 'speelster')
    : 'het team'

  async function copy() {
    try {
      await copyToClipboard(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <button onClick={onBack} style={{ fontSize: 12, cursor: 'pointer', marginBottom: 12 }}>&larr; terug</button>
      <h3 style={{ fontSize: 15, margin: '0 0 4px' }}>{INVITE_TYPE_LABEL[link.report_type] || link.report_type} &middot; {forWhom}</h3>
      <p style={{ fontSize: 13, fontWeight: 600, color: status.color, margin: '0 0 14px' }}>{status.label}</p>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Invullinkje</label>
      <input readOnly value={url} onFocus={e => e.target.select()}
        style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', marginBottom: 10 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={copy} className="yof-btn" style={{ flex: 1 }}>{copied ? 'Gekopieerd!' : 'Kopieer'}</button>
        <button onClick={() => window.open(url, '_blank')} className="yof-btn"
          style={{ flex: 1, background: 'transparent', border: '1px solid #ddd', color: 'inherit' }}>Openen</button>
      </div>
    </div>
  )
}

function LinksScreen({ matchRef, reportType, existingReport, insertAfterId, onBack, onRefresh }) {
  const meta = LINKS_BLOCK_META[reportType]
  const [links, setLinks] = useState(meta.defaults())
  const [error, setError] = useState('')

  async function create() {
    try {
      await createReportDirect({
        match_ref: matchRef, report_type: reportType, title: meta.reportTitle, body: '', status: 'published',
        links, insert_after_id: insertAfterId || null,
      })
      onBack()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <button onClick={onBack} style={{ fontSize: 12, cursor: 'pointer', marginBottom: 12 }}>&larr; terug</button>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>{meta.title}</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      {existingReport ? (
        <ExistingLinksEditor reportId={existingReport.id} links={existingReport.links || []} onChanged={onRefresh} />
      ) : (
        <>
          <NewLinksEditor links={links} onChange={setLinks} />
          <button onClick={create} style={{ fontSize: 12, cursor: 'pointer' }}>Toevoegen</button>
        </>
      )}
    </div>
  )
}

function GoalsPanel({ matchRef, players }) {
  const [goals, setGoals] = useState({})
  const [saving, setSaving] = useState('')

  useEffect(() => {
    getMatchGoals(matchRef).then(rows => {
      const map = {}
      rows.forEach(r => { map[r.player_id] = r.goals })
      setGoals(map)
    }).catch(() => {})
  }, [matchRef])

  async function save(playerId, value) {
    const n = Math.max(0, parseInt(value, 10) || 0)
    setGoals(g => ({ ...g, [playerId]: n }))
    setSaving(playerId)
    try {
      await setMatchGoal(matchRef, playerId, n)
    } finally {
      setSaving('')
    }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
        {players.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '4px 8px', border: '1px solid #eee', borderRadius: 8 }}>
            <span>{p.nickname || p.name}</span>
            <input type="number" min="0" value={goals[p.id] ?? 0}
              onChange={e => save(p.id, e.target.value)}
              style={{ width: 48, fontSize: 13, padding: '2px 4px', borderRadius: 6, border: '1px solid #ddd', textAlign: 'center' }} />
          </div>
        ))}
      </div>
      {players.length === 0 && <p style={{ color: '#666', fontSize: 13 }}>Nog geen spelers toegevoegd.</p>}
      {saving && <p style={{ fontSize: 11, color: '#999', margin: '6px 0 0' }}>Opslaan...</p>}
    </div>
  )
}

export default function MatchAdminDetail({ matchRef, onBack }) {
  const [item, setItem] = useState(null)
  const [players, setPlayers] = useState([])
  const [reports, setReports] = useState([])
  const [photos, setPhotos] = useState([])
  const [links, setLinks] = useState([])
  const [error, setError] = useState('')
  const [view, setView] = useState('preview') // preview | choose | write | edit | invul | invite | links
  const [editingReport, setEditingReport] = useState(null)
  const [insertAfterId, setInsertAfterId] = useState(null)
  const [linksReportType, setLinksReportType] = useState('wedstrijd_beelden')
  const [activeInviteId, setActiveInviteId] = useState(null)

  function loadReports() {
    getReportsModeration().then(rows => setReports(rows.filter(r => r.match_ref === matchRef))).catch(e => setError(e.message))
  }
  function loadPhotos() {
    getPhotosModeration().then(rows => setPhotos(rows.filter(p => p.match_ref === matchRef))).catch(e => setError(e.message))
  }
  function loadLinks() {
    listContributorLinks().then(rows => setLinks(rows.filter(l => l.match_ref === matchRef))).catch(() => {})
  }

  useEffect(() => {
    getTimelineItem(matchRef).then(setItem).catch(e => setError(e.message))
    getPlayers().then(setPlayers).catch(() => {})
    loadReports()
    loadPhotos()
    loadLinks()
  }, [matchRef])

  function entryTitle() {
    return item?.title || matchRef
  }

  async function togglePhotoTag(p, playerId) {
    if (p.player_ids.includes(playerId)) await untagPhoto(p.id, playerId)
    else await tagPhoto(p.id, playerId)
    loadPhotos()
  }
  async function togglePublishPhoto(p) {
    await updatePhoto(p.id, { status: p.status === 'published' ? 'concept' : 'published' })
    loadPhotos()
  }
  async function deletePhotoRow(id) {
    await deletePhoto(id)
    loadPhotos()
  }
  async function savePhotoCaption(p, value) {
    await updatePhoto(p.id, { caption: value })
    loadPhotos()
  }

  function backToPreview() {
    setEditingReport(null)
    setInsertAfterId(null)
    setView('preview')
    loadReports()
    loadLinks()
  }

  function handleEditReport(report) {
    if (report.report_type === 'instagram' || report.report_type === 'wedstrijd_beelden') {
      setLinksReportType(report.report_type)
      setView('links')
      return
    }
    setEditingReport(report)
    setView('edit')
  }

  function addItemAt(afterId) {
    setInsertAfterId(afterId)
    setView('choose')
  }

  async function handleMoveReport(reportId, direction) {
    await moveReport(reportId, direction)
  }

  async function handleMovePhotoBlock(direction) {
    await movePhotoBlock(matchRef, direction)
  }

  async function toggleEditingReportTag(playerId) {
    if (!editingReport) return
    const tagged = (editingReport.player_ids || []).includes(playerId)
    if (tagged) await untagReport(editingReport.id, playerId)
    else await tagReport(editingReport.id, playerId)
    const fresh = await getReportsModeration()
    const updated = fresh.find(r => r.id === editingReport.id)
    if (updated) setEditingReport(updated)
    setReports(fresh.filter(r => r.match_ref === matchRef))
  }

  const linksExistingReport = reports.find(r => r.report_type === linksReportType)
  const activeInvite = links.find(l => l.id === activeInviteId)

  const TYPE_LABEL = { wedstrijdverslag: 'Wedstrijdverslag', interview: 'Interview' }
  function playerName(id) {
    return players.find(p => p.id === id)?.nickname || players.find(p => p.id === id)?.name
  }
  const pendingInvites = links
    .filter(l => !l.report_status)
    .map(l => {
      const status = contributorLinkStatus(l)
      const forWhom = l.player_id ? playerName(l.player_id) || 'speelster' : 'het team'
      return { id: l.id, title: `${TYPE_LABEL[l.report_type] || l.report_type} · ${forWhom}`, statusLabel: status.label, statusColor: status.color }
    })

  return (
    <div>
      <button onClick={onBack} style={{ fontSize: 13, cursor: 'pointer', marginBottom: 10 }}>&larr; terug naar de lijst</button>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      {item && <h3 style={{ fontSize: 16, margin: '0 0 4px' }}>{item.title}</h3>}
      {item && <p style={{ fontSize: 12, color: '#666', margin: '0 0 16px' }}>{item.date?.slice(0, 10)} &middot; {item.kind}</p>}

      {view === 'choose' && (
        <ChooseReportKind
          onWriteMyself={() => setView('write')}
          onSendInvite={() => setView('invul')}
          onAddInstagram={() => { setLinksReportType('instagram'); setView('links') }}
          onAddFootage={() => { setLinksReportType('wedstrijd_beelden'); setView('links') }}
          onBack={() => { setInsertAfterId(null); setView('preview') }}
        />
      )}
      {view === 'write' && (
        <ReportForm fixedMatchRef={matchRef} fixedMatchTitle={entryTitle()} insertAfterId={insertAfterId}
          onSaved={backToPreview} onCancel={() => setView('choose')} />
      )}
      {view === 'edit' && editingReport && (
        <ReportForm
          fixedMatchRef={matchRef} fixedMatchTitle={entryTitle()} existingReport={editingReport}
          players={players} onToggleTag={toggleEditingReportTag}
          onSaved={backToPreview} onCancel={backToPreview} onDeleted={backToPreview}
        />
      )}
      {view === 'invul' && (
        <InviteLinkScreen matchRef={matchRef} players={players} onBack={() => setView('choose')} />
      )}
      {view === 'invite' && (
        <InviteDetailScreen link={activeInvite} players={players} onBack={() => { setActiveInviteId(null); setView('preview') }} />
      )}
      {view === 'links' && (
        <LinksScreen matchRef={matchRef} reportType={linksReportType} existingReport={linksExistingReport}
          insertAfterId={insertAfterId} onBack={backToPreview} onRefresh={loadReports} />
      )}

      {view === 'preview' && (
        <>
          <PublicEntry
            matchRef={matchRef} onBack={() => {}} previewMode adminMode
            onEditReport={handleEditReport}
            onAddItem={addItemAt}
            onMoveReport={handleMoveReport}
            onMovePhotoBlock={handleMovePhotoBlock}
            pendingInvites={pendingInvites}
            onOpenInvites={id => { setActiveInviteId(id); setView('invite') }}
          />

          <h4 style={{ fontSize: 14, margin: '20px 0 8px' }}>Doelpunten</h4>
          <div style={{ marginBottom: 20 }}>
            <GoalsPanel matchRef={matchRef} players={players} />
          </div>

          <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Foto&rsquo;s</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
            {photos.map(p => (
              <PhotoCard key={p.id} photo={p} players={players} entryTitle={entryTitle}
                onTogglePublish={togglePublishPhoto} onDelete={deletePhotoRow} onToggleTag={togglePhotoTag} onSaveCaption={savePhotoCaption} />
            ))}
            {photos.length === 0 && <p style={{ color: '#666', fontSize: 13 }}>Nog geen foto&rsquo;s voor deze wedstrijd.</p>}
          </div>
        </>
      )}
    </div>
  )
}
