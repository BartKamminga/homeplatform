import { useState, useEffect } from 'react'
import { addReportLink, updateReportLink, deleteReportLink } from '../api.js'
import { useConfirm } from '@components/ConfirmDialog.jsx'

export const LINK_TYPES = [
  { value: 'instagram', label: 'Instagram', icon: '📸' },
  { value: 'video', label: 'Wedstrijdbeelden', icon: '▶️' },
]

function typeInfo(type) {
  return LINK_TYPES.find(t => t.value === type) || { label: type, icon: '🔗' }
}

let igScriptPromise = null
function loadInstagramEmbedScript() {
  if (window.instgrm) return Promise.resolve()
  if (igScriptPromise) return igScriptPromise
  igScriptPromise = new Promise(resolve => {
    const existing = document.querySelector('script[src="https://www.instagram.com/embed.js"]')
    if (existing) {
      existing.addEventListener('load', resolve, { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://www.instagram.com/embed.js'
    script.async = true
    script.onload = resolve
    document.body.appendChild(script)
  })
  return igScriptPromise
}

function InstagramEmbed({ url, note }) {
  useEffect(() => {
    let cancelled = false
    loadInstagramEmbedScript().then(() => {
      if (!cancelled && window.instgrm) window.instgrm.Embeds.process()
    })
    return () => { cancelled = true }
  }, [url])

  return (
    <div style={{ margin: '0 auto 12px', maxWidth: 540 }}>
      {note && <p style={{ fontSize: 12, color: '#666', margin: '0 0 6px', textAlign: 'center' }}>{note}</p>}
      <blockquote className="instagram-media" data-instgrm-permalink={url} data-instgrm-version="14"
        style={{ background: '#FFF', border: 0, borderRadius: 12, margin: '0 auto', maxWidth: 540, width: '100%', minWidth: 250 }}>
        <a href={url} target="_blank" rel="noreferrer">Bekijk deze post op Instagram</a>
      </blockquote>
    </div>
  )
}

function parseYoutubeId(url) {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return u.pathname.slice(1) || null
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      const match = u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)
      if (match) return match[1]
    }
  } catch {
    return null
  }
  return null
}

function YoutubeEmbed({ url, note }) {
  const id = parseYoutubeId(url)
  if (!id) return null
  return (
    <div>
      <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}`}
          title="YouTube video"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      {note && <p style={{ fontSize: 12, color: '#666', margin: '4px 0 0', textAlign: 'center' }}>{note}</p>}
    </div>
  )
}

const fieldStyle = { boxSizing: 'border-box', padding: 8, fontSize: 13, borderRadius: 6, border: '1px solid #ccc', width: '100%', minWidth: 0 }
const rowStyle = { display: 'grid', gridTemplateColumns: '130px minmax(0, 1fr) minmax(0, 1fr) auto', gap: 6, marginBottom: 6, alignItems: 'center' }

// Instagram en Wedstrijdbeelden zijn twee losse, los-positioneerbare
// blokken op de wedstrijdpagina - elk met hun eigen standaard-rijen.
export function defaultInstagramLinks() {
  return [{ link_type: 'instagram', url: '', note: '' }]
}

export function defaultVideoLinks() {
  return [
    { link_type: 'video', url: '', note: '' },
    { link_type: 'video', url: '', note: '' },
    { link_type: 'video', url: '', note: '' },
    { link_type: 'video', url: '', note: '' },
  ]
}

export function NewLinksEditor({ links, onChange }) {
  function update(i, patch) {
    onChange(links.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  }
  function remove(i) {
    onChange(links.filter((_, idx) => idx !== i))
  }
  function add() {
    onChange([...links, { link_type: 'video', url: '', note: '' }])
  }

  return (
    <div style={{ marginBottom: 8 }}>
      {links.map((l, i) => (
        <div key={i} style={rowStyle}>
          <select value={l.link_type} onChange={e => update(i, { link_type: e.target.value })} style={{ fontSize: 12, width: '100%' }}>
            {LINK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input value={l.url} onChange={e => update(i, { url: e.target.value })} placeholder="Link (optioneel)" style={fieldStyle} />
          <input value={l.note} onChange={e => update(i, { note: e.target.value })} placeholder="Notitie (optioneel)" style={fieldStyle} />
          <button onClick={() => remove(i)} className="yof-btn-secondary">x</button>
        </div>
      ))}
      <button onClick={add} className="yof-btn-secondary">+ nog een linkje</button>
    </div>
  )
}

function ExistingLinkRow({ link, onSave, onDelete }) {
  const [form, setForm] = useState({ link_type: link.link_type, url: link.url, note: link.note || '' })
  const [saving, setSaving] = useState(false)
  const [confirm, confirmDialog] = useConfirm()

  async function save() {
    setSaving(true)
    try {
      await onSave({ link_type: form.link_type, url: form.url, note: form.note || null })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!(await confirm('Dit linkje verwijderen? Dit kan niet ongedaan gemaakt worden.'))) return
    onDelete()
  }

  return (
    <div style={{ ...rowStyle, gridTemplateColumns: '130px minmax(0, 1fr) minmax(0, 1fr) auto auto' }}>
      {confirmDialog}
      <select value={form.link_type} onChange={e => setForm({ ...form, link_type: e.target.value })} style={{ fontSize: 12, width: '100%' }}>
        {LINK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="Link" style={fieldStyle} />
      <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Notitie (optioneel)" style={fieldStyle} />
      <button onClick={save} className="yof-btn-secondary">{saving ? '...' : 'Opslaan'}</button>
      <button onClick={handleDelete} className="yof-btn-secondary">Verwijder</button>
    </div>
  )
}

// Bestaand verslag - rechtstreeks tegen de link-endpoints, toont alleen de
// al ingevulde linkjes plus een mini-formulier om er nog een toe te voegen.
export function ExistingLinksEditor({ reportId, links, onChanged }) {
  const [newType, setNewType] = useState('video')
  const [newUrl, setNewUrl] = useState('')
  const [newNote, setNewNote] = useState('')
  const [error, setError] = useState('')

  async function saveRow(link, body) {
    try {
      await updateReportLink(link.id, body)
      onChanged()
    } catch (e) {
      setError(e.message)
    }
  }
  async function removeRow(link) {
    try {
      await deleteReportLink(link.id)
      onChanged()
    } catch (e) {
      setError(e.message)
    }
  }
  async function add() {
    if (!newUrl.trim()) return
    try {
      await addReportLink(reportId, { link_type: newType, url: newUrl, note: newNote || null })
      setNewUrl(''); setNewNote('')
      onChanged()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div style={{ marginBottom: 8 }}>
      {error && <p style={{ color: '#c23b3b', fontSize: 12 }}>{error}</p>}
      {links.map(l => (
        <ExistingLinkRow key={l.id} link={l} onSave={body => saveRow(l, body)} onDelete={() => removeRow(l)} />
      ))}
      <div style={rowStyle}>
        <select value={newType} onChange={e => setNewType(e.target.value)} style={{ fontSize: 12, width: '100%' }}>
          {LINK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="Nieuwe link" style={fieldStyle} />
        <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Notitie (optioneel)" style={fieldStyle} />
        <button onClick={add} className="yof-btn-secondary">+ toevoegen</button>
      </div>
    </div>
  )
}

// Publieke weergave: Instagram-links worden echt ingebed (embed.js-widget),
// YouTube-links (link_type "video") krijgen een echte video-preview (iframe).
// Alles wat niet herkend/ingebed kan worden blijft een preview-tegel.
export function LinkTiles({ links }) {
  if (!links || links.length === 0) return null
  const instagramLinks = links.filter(l => l.link_type === 'instagram')
  const videoLinks = links.filter(l => l.link_type === 'video')
  const embeddableVideos = videoLinks.filter(l => parseYoutubeId(l.url))
  const tileLinks = links.filter(l => l.link_type !== 'instagram' && !embeddableVideos.includes(l))

  return (
    <div style={{ marginTop: 8 }}>
      {instagramLinks.map(l => <InstagramEmbed key={l.id} url={l.url} note={l.note} />)}
      {embeddableVideos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, marginBottom: 12 }}>
          {embeddableVideos.map(l => <YoutubeEmbed key={l.id} url={l.url} note={l.note} />)}
        </div>
      )}
      {tileLinks.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {tileLinks.map(l => {
            const info = typeInfo(l.link_type)
            return (
              <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="yof-card"
                style={{ display: 'block', textDecoration: 'none', color: 'inherit', textAlign: 'center', padding: 12 }}>
                <div style={{ fontSize: 22 }}>{info.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{info.label}</div>
                {l.note && <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{l.note}</div>}
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
