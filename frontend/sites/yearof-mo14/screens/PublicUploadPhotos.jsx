import { useState, useEffect } from 'react'
import { getTimeline, uploadPhoto } from '../api.js'
import { compressImage } from '../compressImage.js'
import { getStoredCode } from '../gate.js'

export default function PublicUploadPhotos() {
  const [entries, setEntries] = useState([])
  const [matchRef, setMatchRef] = useState('')
  const [photoType, setPhotoType] = useState('actie')
  const [files, setFiles] = useState([])
  const [progress, setProgress] = useState(null) // { done, total } | null
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getTimeline().then(items => {
      const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date))
      setEntries(sorted)
      if (sorted.length) setMatchRef(sorted[0].match_ref)
    }).catch(e => setError(e.message))
  }, [])

  async function submit() {
    if (!matchRef || files.length === 0) return
    setError('')
    setDone(false)
    setProgress({ done: 0, total: files.length })
    const code = getStoredCode()

    for (let i = 0; i < files.length; i++) {
      try {
        const compressed = await compressImage(files[i])
        await uploadPhoto(compressed, { matchRef, photoType, code })
      } catch (e) {
        setError(`Foto ${i + 1} mislukt: ${e.message}`)
      }
      setProgress({ done: i + 1, total: files.length })
    }
    setFiles([])
    setDone(true)
  }

  return (
    <div>
      <h2 style={{ fontSize: 17, margin: '0 0 12px' }}>Foto&rsquo;s toevoegen</h2>

      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Bij welke wedstrijd/dag?</label>
      <select value={matchRef} onChange={e => setMatchRef(e.target.value)}
        style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #ddd', marginBottom: 14, fontSize: 15 }}>
        {entries.map(it => (
          <option key={it.match_ref} value={it.match_ref}>{it.date?.slice(0, 10)} — {it.title}</option>
        ))}
      </select>

      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Soort foto</label>
      <select value={photoType} onChange={e => setPhotoType(e.target.value)}
        style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #ddd', marginBottom: 14, fontSize: 15 }}>
        <option value="actie">Actie</option>
        <option value="team">Team</option>
        <option value="sfeer">Sfeer</option>
      </select>

      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Foto&rsquo;s kiezen</label>
      <input type="file" accept="image/*" multiple
        onChange={e => setFiles(Array.from(e.target.files || []))}
        style={{ display: 'block', marginBottom: 14, fontSize: 14 }} />

      {files.length > 0 && <p style={{ fontSize: 13, color: '#666' }}>{files.length} foto&rsquo;s geselecteerd</p>}
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      {progress && (
        <p style={{ fontSize: 13, color: '#666' }}>
          {progress.done < progress.total ? `Versturen... ${progress.done}/${progress.total}` : `${progress.done} foto's verstuurd`}
        </p>
      )}
      {done && (
        <p style={{ fontSize: 13, color: '#16a34a' }}>
          Bedankt! Je foto&rsquo;s worden zichtbaar na goedkeuring door de teammanager.
        </p>
      )}

      <button className="yof-btn" onClick={submit} disabled={!matchRef || files.length === 0 || (progress && progress.done < progress.total)}>
        Versturen
      </button>
    </div>
  )
}
