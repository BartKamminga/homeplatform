import { useState, useEffect } from 'react'
import { getContributorContext, submitReport } from '../api.js'

export default function ContributeReport({ code }) {
  const [context, setContext] = useState(null)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [instaUrl, setInstaUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    getContributorContext(code).then(ctx => {
      setContext(ctx)
      const existing = ctx.existing_report
      if (existing) {
        setTitle(existing.title || '')
        setBody(existing.body || '')
        setAuthorName(existing.author_name || '')
        setInstaUrl(existing.insta_url || '')
        setYoutubeUrl(existing.youtube_url || '')
      }
    }).catch(e => setError(e.message))
  }, [code])

  async function submit() {
    if (!title.trim() || !body.trim()) return
    try {
      await submitReport({
        contributor_code: code,
        title,
        body,
        author_name: authorName || null,
        insta_url: instaUrl || null,
        youtube_url: youtubeUrl || null,
      })
      setSent(true)
    } catch (e) {
      setError(e.message)
    }
  }

  if (error) {
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

  return (
    <div className="yof">
      <div className="yof-header"><div className="brand">🏑 MO14 à Paris</div></div>
      <div className="yof-main">
        <div className="yof-hero">
          <h1 style={{ fontSize: 18 }}>
            {context.player_name ? `Hoi ${context.player_name}!` : 'Vertel je verhaal'}
          </h1>
          <p>{context.match_title}</p>
        </div>

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

        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Jouw verhaaltje</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={6}
          placeholder="Hoe was de wedstrijd voor jou? Wat was je mooiste moment?"
          style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #ddd', marginBottom: 14, fontSize: 15 }} />

        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Jouw naam</label>
        <input value={authorName} onChange={e => setAuthorName(e.target.value)} placeholder="Optioneel"
          style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #ddd', marginBottom: 14, fontSize: 15 }} />

        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Instagram-post (optioneel)</label>
        <input value={instaUrl} onChange={e => setInstaUrl(e.target.value)} placeholder="https://instagram.com/p/..."
          style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #ddd', marginBottom: 14, fontSize: 15 }} />

        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>YouTube-video (optioneel)</label>
        <input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..."
          style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #ddd', marginBottom: 14, fontSize: 15 }} />

        {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
        <button className="yof-btn" onClick={submit}>Versturen ter controle</button>
        <p style={{ fontSize: 12, color: '#999', textAlign: 'center', marginTop: 10 }}>
          Foto&rsquo;s kun je apart toevoegen via &ldquo;Foto&rsquo;s toevoegen&rdquo; op de site.
        </p>
      </div>
    </div>
  )
}
