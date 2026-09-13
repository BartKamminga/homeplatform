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

  // Plakken (Ctrl+V) van een foto uit het klembord toevoegen, naast de bestandskiezer.
  useEffect(() => {
    function handlePaste(e) {
      const items = Array.from(e.clipboardData?.items || [])
      const pasted = items
        .filter(item => item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter(Boolean)
      if (pasted.length) {
        setFiles(prev => [...prev, ...pasted])
      }
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
      <h2 style={{ fontSize: 17, margin: '0 0 12px' }}>Foto&rsquo;s &amp; filmpjes toevoegen</h2>

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

      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Foto&rsquo;s of filmpjes kiezen</label>
      <input type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple
        onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = '' }}
        style={{ display: 'block', marginBottom: 8, fontSize: 14 }} />
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 14px' }}>
        Je kunt hier ook een gekopieerde foto plakken (Ctrl+V / Cmd+V). Filmpjes tot 200MB (mp4/mov/webm).
      </p>

      {files.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6, marginBottom: 10 }}>
          {files.map((f, i) => (
            <div key={i} style={{ position: 'relative' }}>
              {f.type.startsWith('video/') ? (
                <div style={{
                  width: '100%', aspectRatio: '1', borderRadius: 8, background: '#12203c',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                }}>▶️</div>
              ) : (
                <img src={URL.createObjectURL(f)} alt=""
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, display: 'block' }} />
              )}
              <button onClick={() => removeFile(i)} style={{
                position: 'absolute', top: 2, right: 2, border: 'none', borderRadius: '50%',
                width: 18, height: 18, fontSize: 11, lineHeight: '18px', padding: 0,
                background: 'rgba(0,0,0,.6)', color: 'white', cursor: 'pointer',
              }}>&times;</button>
            </div>
          ))}
        </div>
      )}
      {files.length > 0 && <p style={{ fontSize: 13, color: '#666' }}>{files.length} bestand{files.length === 1 ? '' : 'en'} geselecteerd</p>}
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      {progress && (
        <p style={{ fontSize: 13, color: '#666' }}>
          {progress.done < progress.total ? `Versturen... ${progress.done}/${progress.total}` : `${progress.done} verstuurd`}
        </p>
      )}
      {done && (
        <p style={{ fontSize: 13, color: '#16a34a' }}>
          Bedankt! Ze worden zichtbaar na goedkeuring door de teammanager.
        </p>
      )}

      <button className="yof-btn" onClick={submit} disabled={!matchRef || files.length === 0 || (progress && progress.done < progress.total)}>
        Versturen
      </button>
    </div>
  )
}
