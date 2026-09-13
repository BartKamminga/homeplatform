import { useState, useEffect } from 'react'
import { getProfileLinkContext, submitPlayerEdit, uploadProfilePhoto } from '../api.js'
import { storeProfileCode } from '../profileGate.js'

export default function EditProfile({ code }) {
  const [player, setPlayer] = useState(null)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [nickname, setNickname] = useState('')
  const [position, setPosition] = useState('')
  const [bio, setBio] = useState('')
  const [funFacts, setFunFacts] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    getProfileLinkContext(code).then(p => {
      setPlayer(p)
      setNickname(p.nickname || '')
      setPosition(p.position || '')
      setBio(p.bio || '')
      setFunFacts(p.fun_facts || '')
      storeProfileCode(p.id, code)
    }).catch(e => setError(e.message))
  }, [code])

  function pickPhoto(file) {
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function submit() {
    try {
      let photoUrl = null
      if (photoFile) {
        setUploadingPhoto(true)
        const res = await uploadProfilePhoto(code, photoFile)
        photoUrl = res.photo_url
        setUploadingPhoto(false)
      }
      await submitPlayerEdit({
        profile_link_code: code,
        nickname: nickname || null,
        position: position || null,
        bio: bio || null,
        fun_facts: funFacts || null,
        photo_url: photoUrl,
      })
      setSent(true)
    } catch (e) {
      setUploadingPhoto(false)
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
  if (!player) return null

  if (showPreview) {
    const photoSrc = photoPreview || player.photo_url
    return (
      <div className="yof">
        <div className="yof-header"><div className="brand">🏑 MO14 à Paris</div></div>
        <div className="yof-main">
          <a className="yof-back" href="#" onClick={e => { e.preventDefault(); setShowPreview(false) }}>&larr; terug naar bewerken</a>
          <div className="yof-card" style={{ textAlign: 'center' }}>
            {photoSrc ? (
              <img src={photoSrc} alt="" style={{
                width: 72, height: 72, margin: '0 auto 12px', borderRadius: '50%', objectFit: 'cover', display: 'block',
              }} />
            ) : (
              <div className="avatar" style={{
                width: 72, height: 72, margin: '0 auto 12px', borderRadius: '50%',
                background: 'linear-gradient(160deg, #2a2a2a, #0b0b0b)', color: '#f4c81e',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20,
              }}>
                {player.shirt_number ?? '?'}
              </div>
            )}
            <h2 style={{ margin: '0 0 2px', fontSize: 18 }}>{nickname || player.name}</h2>
            {nickname && <p style={{ margin: '0 0 4px', fontSize: 13, color: '#666' }}>{player.name}</p>}
            <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
              {position || '-'} {player.shirt_number ? `· #${player.shirt_number}` : ''}
            </p>
            {bio && <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.5 }}>{bio}</p>}
            {funFacts && (
              <p style={{ marginTop: 10, fontSize: 13, color: '#666', fontStyle: 'italic' }}>&ldquo;{funFacts}&rdquo;</p>
            )}
          </div>
          <p style={{ fontSize: 12, color: '#999', textAlign: 'center', margin: '10px 0 0' }}>
            Zo ziet jouw profiel eruit zodra dit is goedgekeurd. Nog niet verstuurd.
          </p>
          <button className="yof-btn" onClick={() => setShowPreview(false)} style={{ marginTop: 14 }}>
            &larr; Terug om verder te bewerken
          </button>
        </div>
      </div>
    )
  }

  if (sent) {
    return (
      <div className="yof yof-gate">
        <div className="yof-gate-card">
          <div style={{ fontSize: 32 }}>🎉</div>
          <h1 style={{ fontSize: 18 }}>Bedankt!</h1>
          <p style={{ fontSize: 14, color: '#666' }}>
            Je wijzigingen zijn verstuurd en verschijnen op je profiel zodra de teammanager ze heeft goedgekeurd.
          </p>
          <button className="yof-btn" onClick={() => { setPhotoFile(null); setPhotoPreview(''); setSent(false) }}>
            &larr; Terug om verder te bewerken
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="yof">
      <div className="yof-header"><div className="brand">🏑 MO14 à Paris</div></div>
      <div className="yof-main">
        <div className="yof-hero">
          <h1 style={{ fontSize: 18 }}>Hoi {player.nickname || player.name}, dit is jouw profiel</h1>
          <p>Werk je gegevens bij wanneer je maar wilt.</p>
        </div>

        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Profielfoto</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <img
            src={photoPreview || player.photo_url || ''}
            alt=""
            style={{
              width: 64, height: 64, borderRadius: '50%', objectFit: 'cover',
              background: 'linear-gradient(160deg, #2a2a2a, #0b0b0b)',
              display: photoPreview || player.photo_url ? 'block' : 'none',
            }}
          />
          {!photoPreview && !player.photo_url && (
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(160deg, #2a2a2a, #0b0b0b)', color: '#f4c81e',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
            }}>
              {player.shirt_number ?? '?'}
            </div>
          )}
          <input type="file" accept="image/*" onChange={e => pickPhoto(e.target.files?.[0])} style={{ fontSize: 13 }} />
        </div>

        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Bijnaam</label>
        <input value={nickname} onChange={e => setNickname(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #ddd', marginBottom: 14, fontSize: 15 }} />

        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Positie</label>
        <input value={position} onChange={e => setPosition(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #ddd', marginBottom: 14, fontSize: 15 }} />

        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Over mij</label>
        <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4}
          style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #ddd', marginBottom: 14, fontSize: 15 }} />

        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Leuk weetje over jezelf</label>
        <textarea value={funFacts} onChange={e => setFunFacts(e.target.value)} rows={2}
          placeholder="Bijv. je favoriete actie, hockeyheld, of waar je naar uitkijkt in Parijs"
          style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #ddd', marginBottom: 14, fontSize: 15 }} />

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="yof-btn" onClick={() => setShowPreview(true)} style={{ flex: 1, background: 'transparent', border: '1px solid #ddd', color: 'inherit' }}>
            Voorbeeld bekijken
          </button>
          <button className="yof-btn" onClick={submit} disabled={uploadingPhoto} style={{ flex: 1 }}>
            {uploadingPhoto ? 'Foto uploaden...' : 'Opslaan (ter controle)'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#999', textAlign: 'center', marginTop: 10 }}>
          Wijzigingen verschijnen pas online na goedkeuring door de teammanager.
        </p>
      </div>
    </div>
  )
}
