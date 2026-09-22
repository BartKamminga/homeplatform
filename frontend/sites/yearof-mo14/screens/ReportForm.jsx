import { useState, useEffect } from 'react'
import { createReportDirect, updateReport, deleteReport, uploadPhoto, deletePhoto, getPhotosModeration } from '../api.js'
import { compressImage } from '../compressImage.js'
import { useConfirm } from '@components/ConfirmDialog.jsx'
import { NewLinksEditor, ExistingLinksEditor, LinkTiles } from './ReportLinks.jsx'

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }
const wideFieldStyle = { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #ddd', marginBottom: 14, fontSize: 15 }

// Gedeeld invulformulier voor een DOOR DE BEHEERDER geschreven verslag/
// interview - zowel voor nieuw aanmaken als bewerken van bestaande content.
// Zelfde stijl en voorbeeld-modus als de publieke invulpagina
// (ContributeReport.jsx) en het spelersprofiel (EditProfile.jsx), zodat je
// precies ziet hoe het wordt voor je publiceert.
//
// matchOptions: [{match_ref, title}] - alleen relevant zonder fixedMatchRef.
// fixedMatchRef/fixedMatchTitle: wedstrijd vastzetten (geen selector, geen
// "algemeen"-optie) - voor de wedstrijd-adminpagina.
// existingReport: meegeven om te bewerken i.p.v. aan te maken.
export function ReportForm({
  matchOptions = [], fixedMatchRef, fixedMatchTitle, existingReport, insertAfterId, defaultReportType,
  players, onToggleTag, onSaved, onCancel, onDeleted, onLinksChanged,
}) {
  const isEdit = !!existingReport
  const [matchRef, setMatchRef] = useState(existingReport?.match_ref || fixedMatchRef || '')
  const [reportType, setReportType] = useState(existingReport?.report_type || defaultReportType || 'wedstrijdverslag')
  const [role, setRole] = useState(existingReport?.interviewee_role || 'speelster')
  const [title, setTitle] = useState(existingReport?.title || '')
  const [body, setBody] = useState(existingReport?.body || '')
  const [authorName, setAuthorName] = useState(existingReport?.author_name || '')
  const [showPreview, setShowPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [confirm, confirmDialog] = useConfirm()
  const [photoFiles, setPhotoFiles] = useState([])
  const [existingPhotos, setExistingPhotos] = useState([])
  const [newLinks, setNewLinks] = useState([])

  function loadExistingPhotos() {
    if (!isEdit) return
    getPhotosModeration().then(rows => setExistingPhotos(rows.filter(p => p.report_id === existingReport.id))).catch(() => {})
  }
  useEffect(loadExistingPhotos, [existingReport?.id])

  function addPhotoFiles(newFiles) {
    setPhotoFiles(prev => [...prev, ...newFiles])
  }
  function removePhotoFile(index) {
    setPhotoFiles(prev => prev.filter((_, i) => i !== index))
  }
  async function removeExistingPhoto(id) {
    if (!(await confirm('Deze foto/video verwijderen? Dit kan niet ongedaan gemaakt worden.'))) return
    await deletePhoto(id)
    loadExistingPhotos()
  }

  async function uploadStagedPhotos(reportId, reportMatchRef) {
    for (const file of photoFiles) {
      try {
        const compressed = await compressImage(file)
        await uploadPhoto(compressed, { matchRef: reportMatchRef || null, reportId, photoType: 'actie' })
      } catch {
        // 1 mislukte foto mag het opslaan van het verslag niet blokkeren
      }
    }
    setPhotoFiles([])
  }

  async function submit() {
    if (!title.trim() || !body.trim()) return
    setSending(true)
    try {
      const data = {
        match_ref: matchRef || null,
        report_type: reportType,
        interviewee_role: reportType === 'interview' ? role : null,
        title, body,
        author_name: authorName || null,
      }
      if (isEdit) {
        await updateReport(existingReport.id, data)
        await uploadStagedPhotos(existingReport.id, matchRef)
      } else {
        const links = newLinks.filter(l => l.url && l.url.trim())
        const report = await createReportDirect({
          ...data, status: 'published', insert_after_id: insertAfterId || null,
          links: links.length > 0 ? links : null,
        })
        await uploadStagedPhotos(report.id, report.match_ref)
      }
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  async function togglePublish() {
    await updateReport(existingReport.id, { status: existingReport.status === 'published' ? 'concept' : 'published' })
    onSaved()
  }

  async function toggleFeatured() {
    await updateReport(existingReport.id, { featured: !existingReport.featured })
    onSaved()
  }

  async function toggleMatchHighlight() {
    await updateReport(existingReport.id, { match_highlight: !existingReport.match_highlight })
    onSaved()
  }

  async function remove() {
    if (!(await confirm('Dit bericht verwijderen? Dit kan niet ongedaan gemaakt worden.'))) return
    await deleteReport(existingReport.id)
    onDeleted()
  }

  if (showPreview) {
    return (
      <div style={{ marginBottom: 24 }}>
        <a className="yof-back" href="#" onClick={e => { e.preventDefault(); setShowPreview(false) }}>&larr; terug naar bewerken</a>
        <div className="yof-card" style={{ marginBottom: 10 }}>
          <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>{title || '(geen titel)'}</h4>
          {authorName && <p style={{ margin: '0 0 4px', fontSize: 12, color: '#666' }}>door {authorName}</p>}
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{body || '(geen tekst)'}</p>
          {(existingPhotos.length > 0 || photoFiles.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6, marginTop: 8 }}>
              {existingPhotos.map(p => (
                p.media_type === 'video' ? (
                  <div key={p.id} style={{ width: '100%', aspectRatio: '1', borderRadius: 8, background: '#12203c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>▶️</div>
                ) : (
                  <img key={p.id} src={`/api/yearof-mo14/photos/${p.id}/thumb.jpg`} alt=""
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                )
              ))}
              {photoFiles.map((f, i) => (
                f.type.startsWith('video/') ? (
                  <div key={`new-${i}`} style={{ width: '100%', aspectRatio: '1', borderRadius: 8, background: '#12203c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>▶️</div>
                ) : (
                  <img key={`new-${i}`} src={URL.createObjectURL(f)} alt=""
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                )
              ))}
            </div>
          )}
          {isEdit && <LinkTiles links={existingReport.links} />}
        </div>
        <p style={{ fontSize: 12, color: '#999', margin: '0 0 10px' }}>Zo ziet dit bericht eruit op de site.</p>
        <button className="yof-btn" onClick={() => setShowPreview(false)}>&larr; Terug om verder te bewerken</button>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 24 }}>
      {confirmDialog}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{ fontSize: 15, margin: 0 }}>{isEdit ? 'Verslag bewerken' : 'Nieuw verslag / interview'}</h3>
        <button onClick={onCancel} style={{ fontSize: 12, cursor: 'pointer' }}>&larr; terug</button>
      </div>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {fixedMatchRef ? (
          <span style={{ fontSize: 13, color: '#666', padding: '6px 0' }}>{fixedMatchTitle}</span>
        ) : (
          <select value={matchRef} onChange={e => setMatchRef(e.target.value)} style={{ fontSize: 13 }}>
            <option value="">Geen specifieke wedstrijd (algemeen)</option>
            {matchOptions.map(it => <option key={it.match_ref} value={it.match_ref}>{it.title}</option>)}
          </select>
        )}
        <select value={reportType} onChange={e => setReportType(e.target.value)} style={{ fontSize: 13 }}>
          <option value="wedstrijdverslag">Wedstrijdverslag</option>
          <option value="interview">Interview</option>
          {!fixedMatchRef && <option value="nieuws">Algemeen (niet wedstrijd gebonden)</option>}
        </select>
        {reportType === 'interview' && (
          <select value={role} onChange={e => setRole(e.target.value)} style={{ fontSize: 13 }}>
            <option value="speelster">Speelster</option>
            <option value="coach">Coach</option>
            <option value="ouder">Ouder</option>
          </select>
        )}
      </div>

      <label style={labelStyle}>Titel</label>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Bijv. Een spannende wedstrijd" style={wideFieldStyle} />

      <label style={labelStyle}>Tekst</label>
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} style={wideFieldStyle} />

      <label style={labelStyle}>Door (naam, optioneel)</label>
      <input value={authorName} onChange={e => setAuthorName(e.target.value)} style={wideFieldStyle} />

      <label style={labelStyle}>Foto&rsquo;s &amp; filmpjes (optioneel)</label>
      {existingPhotos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6, marginBottom: 8 }}>
          {existingPhotos.map(p => (
            <div key={p.id} style={{ position: 'relative' }}>
              {p.media_type === 'video' ? (
                <div style={{ width: '100%', aspectRatio: '1', borderRadius: 8, background: '#12203c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>▶️</div>
              ) : (
                <img src={`/api/yearof-mo14/photos/${p.id}/thumb.jpg`} alt=""
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, display: 'block' }} />
              )}
              {p.status === 'concept' && (
                <span style={{ position: 'absolute', top: 2, left: 2, background: '#fde68a', color: '#92400e', fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 999 }}>concept</span>
              )}
              <button onClick={() => removeExistingPhoto(p.id)} style={{
                position: 'absolute', top: 2, right: 2, border: 'none', borderRadius: '50%',
                width: 18, height: 18, fontSize: 11, lineHeight: '18px', padding: 0,
                background: 'rgba(0,0,0,.6)', color: 'white', cursor: 'pointer',
              }}>&times;</button>
            </div>
          ))}
        </div>
      )}
      <input type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple
        onChange={e => { addPhotoFiles(Array.from(e.target.files || [])); e.target.value = '' }}
        style={{ display: 'block', marginBottom: 6, fontSize: 14 }} />
      {photoFiles.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6, marginBottom: 8 }}>
          {photoFiles.map((f, i) => (
            <div key={i} style={{ position: 'relative' }}>
              {f.type.startsWith('video/') ? (
                <div style={{ width: '100%', aspectRatio: '1', borderRadius: 8, background: '#12203c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>▶️</div>
              ) : (
                <img src={URL.createObjectURL(f)} alt=""
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, display: 'block' }} />
              )}
              <button onClick={() => removePhotoFile(i)} style={{
                position: 'absolute', top: 2, right: 2, border: 'none', borderRadius: '50%',
                width: 18, height: 18, fontSize: 11, lineHeight: '18px', padding: 0,
                background: 'rgba(0,0,0,.6)', color: 'white', cursor: 'pointer',
              }}>&times;</button>
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 14px' }}>
        Toegevoegde fotos/filmpjes worden opgeslagen zodra je op Opslaan/Publiceren klikt. Filmpjes tot 200MB (mp4/mov/webm).
      </p>

      <label style={labelStyle}>Links &amp; artikelen (Instagram, wedstrijdbeelden, hockey.nl, sponsors, ...)</label>
      {isEdit ? (
        <ExistingLinksEditor reportId={existingReport.id} links={existingReport.links || []} onChanged={onLinksChanged} />
      ) : (
        <NewLinksEditor links={newLinks} onChange={setNewLinks} />
      )}

      {isEdit && players?.length > 0 && (
        <>
          <label style={labelStyle}>Getagde speelsters</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
            {players.map(pl => {
              const tagged = (existingReport.player_ids || []).includes(pl.id)
              return (
                <button key={pl.id} onClick={() => onToggleTag(pl.id)}
                  style={{
                    border: 'none', borderRadius: 999, padding: '3px 8px', fontSize: 11, cursor: 'pointer',
                    background: tagged ? '#16a34a' : '#e5e7eb', color: tagged ? 'white' : '#555',
                  }}>
                  {pl.nickname || pl.name}
                </button>
              )
            })}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: isEdit ? 8 : 0 }}>
        <button className="yof-btn" onClick={() => setShowPreview(true)}
          style={{ flex: 1, background: 'transparent', border: '1px solid #ddd', color: 'inherit' }}>
          Voorbeeld bekijken
        </button>
        <button className="yof-btn" onClick={submit} disabled={sending} style={{ flex: 1 }}>
          {sending ? 'Opslaan...' : (isEdit ? 'Opslaan' : 'Publiceren')}
        </button>
      </div>

      {isEdit && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={togglePublish} className="yof-btn-secondary">
            {existingReport.status === 'published' ? 'Terug naar concept' : 'Publiceren'}
          </button>
          {reportType !== 'nieuws' && (
            <button onClick={toggleFeatured} className="yof-btn-secondary">
              {existingReport.featured ? 'Uit In de kijker halen' : 'In de kijker zetten'}
            </button>
          )}
          {existingReport.match_ref && (
            <button onClick={toggleMatchHighlight} className="yof-btn-secondary">
              {existingReport.match_highlight ? '⭐ Uit wedstrijdlink halen' : '⭐ Op wedstrijdlink tonen'}
            </button>
          )}
          <button onClick={remove} className="yof-btn-secondary">Verwijderen</button>
        </div>
      )}
    </div>
  )
}
