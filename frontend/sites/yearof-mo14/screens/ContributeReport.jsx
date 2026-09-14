import { useState, useEffect } from 'react'
import { getContributorContext, submitReport, uploadPhoto } from '../api.js'
import { compressImage } from '../compressImage.js'

const TYPE_LABEL = { wedstrijdverslag: 'Wedstrijdverslag', interview: 'Interview', nieuws: 'Algemeen' }
const TYPE_HEADING = {
  wedstrijdverslag: 'Schrijf een wedstrijdverslag',
  interview: 'Vertel je verhaal (interview)',
  nieuws: 'Schrijf een algemeen bericht',
}
const TYPE_TEXT_LABEL = { wedstrijdverslag: 'Het verslag', interview: 'Jouw verhaaltje', nieuws: 'De tekst' }
const TYPE_PLACEHOLDER = {
  wedstrijdverslag: 'Bijv. een vooruitblik: wat verwachten jullie van deze wedstrijd, of een terugblik na afloop.',
  interview: 'Hoe was de wedstrijd voor jou? Wat was je mooiste moment?',
  nieuws: 'Waar gaat je bericht over?',
}

// adminMode: hetzelfde invulformulier als de publieke invullink, maar
// ingebed in de beheerder-module i.p.v. in een los tabblad geopend - zodat
// de beheerder een interview/verslag namens iemand kan intypen zonder de
// wysiwyg-flow te verlaten. Verstuurt nog steeds als concept (submitReport),
// net als de publieke route - alleen de omlijsting/navigatie is anders.
export default function ContributeReport({ code, adminMode = false, onBack, onSaved }) {
  const [context, setContext] = useState(null)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [files, setFiles] = useState([])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    getContributorContext(code).then(ctx => {
      setContext(ctx)
      const existing = ctx.existing_report
      if (existing) {
        setTitle(existing.title || '')
        setBody(existing.body || '')
        setAuthorName(existing.author_name || '')
      }
    }).catch(e => setError(e.message))
  }, [code])

  // Plakken (Ctrl+V) van een foto uit het klembord toevoegen, naast de bestandskiezer.
  useEffect(() => {
    function handlePaste(e) {
      const items = Array.from(e.clipboardData?.items || [])
      const pasted = items
        .filter(item => item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter(Boolean)
      if (pasted.length) setFiles(prev => [...prev, ...pasted])
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  function addFiles(newFiles) {
    setFiles(prev => [...prev, ...newFiles])
  }
  function removeFile(index) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  async function submit() {
    if (!title.trim() || !body.trim()) return
    setSending(true)
    try {
      const report = await submitReport({
        contributor_code: code,
        title,
        body,
        author_name: authorName || null,
      })

      if (files.length) {
        for (const file of files) {
          try {
            const compressed = await compressImage(file)
            await uploadPhoto(compressed, { matchRef: report.match_ref, reportId: report.id, photoType: 'actie', code })
          } catch {
            // 1 mislukte foto mag het insturen van het verhaaltje niet blokkeren
          }
        }
      }

      if (adminMode) {
        onSaved()
        return
      }
      setSent(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  if (error) {
    if (adminMode) return <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>
    return (
      <div className="yof yof-gate">
        <div className="yof-gate-card">
          <div style={{ fontSize: 32 }}>🔒</div>
          <p style={{ fontSize: 14, color: '#c23b3b' }}>{error}</p>
        </div>
      </div>
    )
  }
  if (!context) return null

  if (sent) {
    return (
      <div className="yof yof-gate">
        <div className="yof-gate-card">
          <div style={{ fontSize: 32 }}>🎉</div>
          <h1 style={{ fontSize: 18 }}>Bedankt!</h1>
          <p style={{ fontSize: 14, color: '#666' }}>
            Je verhaaltje is verstuurd en verschijnt (weer) op de site zodra de teammanager het heeft goedgekeurd.
          </p>
        </div>
      </div>
    )
  }

  const formContent = (
    <>
      {adminMode && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ fontSize: 15, margin: 0 }}>{TYPE_LABEL[context.report_type] || context.report_type} invullen</h3>
          <button onClick={onBack} style={{ fontSize: 12, cursor: 'pointer' }}>&larr; terug</button>
        </div>
      )}
      {!adminMode && (
        <div className="yof-hero">
          <div style={{
            display: 'inline-block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
            background: 'rgba(244,200,30,.18)', color: '#f4c81e', padding: '3px 10px', borderRadius: 999, marginBottom: 8,
          }}>
            {TYPE_LABEL[context.report_type] || context.report_type}
          </div>
          <h1 style={{ fontSize: 18 }}>
            {context.player_name ? `Hoi ${context.player_name}!` : (TYPE_HEADING[context.report_type] || 'Vertel je verhaal')}
          </h1>
          <p>{context.match_title}</p>
        </div>
      )}

      {context.existing_report?.status === 'concept' && (
        <p style={{ fontSize: 13, background: '#fdf8e8', padding: 10, borderRadius: 10, marginBottom: 14 }}>
          Je hebt dit al ingestuurd en het wacht nog op goedkeuring. Je kunt de tekst hieronder aanpassen en opnieuw versturen.
        </p>
      )}
      {context.existing_report?.status === 'published' && (
        <p style={{ fontSize: 13, background: '#e8f8ee', padding: 10, borderRadius: 10, marginBottom: 14 }}>
          Dit verhaaltje staat al op de site. Pas de tekst hieronder aan en verstuur opnieuw om een wijziging aan te vragen
          &mdash; die verschijnt pas online na goedkeuring.
        </p>
      )}

      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Titel</label>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Bijv. Een spannende wedstrijd"
        style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #ddd', marginBottom: 14, fontSize: 15 }} />

      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>
        {TYPE_TEXT_LABEL[context.report_type] || 'Jouw verhaaltje'}
      </label>
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={6}
        placeholder={TYPE_PLACEHOLDER[context.report_type] || ''}
        style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #ddd', marginBottom: 14, fontSize: 15 }} />

      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Jouw naam</label>
      <input value={authorName} onChange={e => setAuthorName(e.target.value)} placeholder="Optioneel"
        style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #ddd', marginBottom: 14, fontSize: 15 }} />

      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Foto&rsquo;s (optioneel)</label>
      {context.existing_photos?.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6, marginBottom: 8 }}>
          {context.existing_photos.map(p => (
            <div key={p.id} style={{ position: 'relative' }}>
              {p.media_type === 'video' ? (
                <div style={{ width: '100%', aspectRatio: '1', borderRadius: 8, background: '#12203c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>▶️</div>
              ) : (
                <img src={`/api/yearof-mo14/photos/${p.id}/thumb.jpg`} alt=""
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, display: 'block' }} />
              )}
              {p.status === 'concept' && (
                <span style={{
                  position: 'absolute', top: 2, left: 2, background: '#fde68a', color: '#92400e',
                  fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 999,
                }}>concept</span>
              )}
            </div>
          ))}
        </div>
      )}
      {context.existing_photos?.length > 0 && (
        <p style={{ fontSize: 12, color: '#999', margin: '0 0 8px' }}>
          Dit heb je al toegevoegd. Hieronder kun je er nog meer toevoegen.
        </p>
      )}
      <input type="file" accept="image/*" multiple
        onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = '' }}
        style={{ display: 'block', marginBottom: 6, fontSize: 14 }} />
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 10px' }}>
        Je kunt hier ook een gekopieerde foto plakken (Ctrl+V / Cmd+V).
      </p>
      {files.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6, marginBottom: 14 }}>
          {files.map((f, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={URL.createObjectURL(f)} alt=""
                style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, display: 'block' }} />
              <button onClick={() => removeFile(i)} style={{
                position: 'absolute', top: 2, right: 2, border: 'none', borderRadius: '50%',
                width: 18, height: 18, fontSize: 11, lineHeight: '18px', padding: 0,
                background: 'rgba(0,0,0,.6)', color: 'white', cursor: 'pointer',
              }}>&times;</button>
            </div>
          ))}
        </div>
      )}

      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      <button className="yof-btn" onClick={submit} disabled={sending}>
        {sending ? 'Versturen...' : 'Versturen ter controle'}
      </button>
    </>
  )

  if (adminMode) {
    return <div style={{ marginBottom: 24 }}>{formContent}</div>
  }

  return (
    <div className="yof">
      <div className="yof-header"><div className="brand">🏑 MO14 à Paris</div></div>
      <div className="yof-main">{formContent}</div>
    </div>
  )
}
