import { useState, useEffect } from 'react'
import { getProfileLinkContext, getPlayerModeration, submitPlayerEdit, updatePlayer, uploadProfilePhoto, uploadPlayerPhotoAdmin } from '../api.js'

// Gedeeld met de beheerder-kant (PlayersAdmin, adminMode): zelfde
// invulscherm als de publieke profiellink, zodat spelersprofiel-editen
// overal via dezelfde pagina gaat (wysiwyg) i.p.v. een los admin-formulier.
// Publiek: submit maakt een concept aan (review door teammanager).
// adminMode: submit past direct toe, geen concept-stap.
export default function EditProfile({ code, adminMode = false, playerId, onSaved, onCancel }) {
  const [player, setPlayer] = useState(null)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [name, setName] = useState('')
  const [shirtNumber, setShirtNumber] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [nickname, setNickname] = useState('')
  const [position, setPosition] = useState('')
  const [bio, setBio] = useState('')
  const [funFacts, setFunFacts] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    const load = adminMode ? getPlayerModeration(playerId) : getProfileLinkContext(code)
    load.then(p => {
      setPlayer(p)
      setName(p.name || '')
      setShirtNumber(p.shirt_number ?? '')
      setRoleTitle(p.role_title || '')
      setNickname(p.nickname || '')
      setPosition(p.position || '')
      setBio(p.bio || '')
      setFunFacts(p.fun_facts || '')
    }).catch(e => setError(e.message))
  }, [code, adminMode, playerId])

  function pickPhoto(file) {
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function submit() {
    try {
      if (adminMode) {
        if (photoFile) {
          setUploadingPhoto(true)
          await uploadPlayerPhotoAdmin(playerId, photoFile)
          setUploadingPhoto(false)
        }
        await updatePlayer(playerId, {
          name: name.trim() || player.name,
          shirt_number: shirtNumber !== '' ? Number(shirtNumber) : null,
          role_title: roleTitle || null,
          nickname: nickname || null,
          position: position || null,
          bio: bio || null,
          fun_facts: funFacts || null,
        })
        onSaved()
        return
      }
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
  if (!player) return null

  const previewCard = (
    <div className="yof-card" style={{ textAlign: 'center' }}>
      {(photoPreview || player.photo_url) ? (
        <img src={photoPreview || player.photo_url} alt="" style={{
          width: 72, height: 72, margin: '0 auto 12px', borderRadius: '50%', objectFit: 'cover', display: 'block',
        }} />
      ) : (
        <div className="avatar" style={{
          width: 72, height: 72, margin: '0 auto 12px', borderRadius: '50%',
          background: 'linear-gradient(160deg, #2a2a2a, #0b0b0b)', color: '#f4c81e',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20,
        }}>
          {roleTitle || (shirtNumber !== '' ? shirtNumber : '?')}
        </div>
      )}
      <h2 style={{ margin: '0 0 2px', fontSize: 18 }}>{nickname || name || player.name}</h2>
      {nickname && <p style={{ margin: '0 0 4px', fontSize: 13, color: '#666' }}>{name || player.name}</p>}
      <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
        {roleTitle || position || '-'} {!roleTitle && shirtNumber !== '' ? `· #${shirtNumber}` : ''}
      </p>
      {bio && <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.5 }}>{bio}</p>}
      {funFacts && (
        <p style={{ marginTop: 10, fontSize: 13, color: '#666', fontStyle: 'italic' }}>&ldquo;{funFacts}&rdquo;</p>
      )}
    </div>
  )

  if (showPreview) {
    if (adminMode) {
      return (
        <div style={{ marginBottom: 24 }}>
          <a className="yof-back" href="#" onClick={e => { e.preventDefault(); setShowPreview(false) }}>&larr; terug naar bewerken</a>
          {previewCard}
          <button className="yof-btn" onClick={() => setShowPreview(false)} style={{ marginTop: 14 }}>
            &larr; Terug om verder te bewerken
          </button>
        </div>
      )
    }
    return (
      <div className="yof">
        <div className="yof-header"><div className="brand">🏑 MO14 à Paris</div></div>
        <div className="yof-main">
          <a className="yof-back" href="#" onClick={e => { e.preventDefault(); setShowPreview(false) }}>&larr; terug naar bewerken</a>
          {previewCard}
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

  const formFields = (
    <>
      {adminMode && (
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Naam</label>
            <input value={name} onChange={e => setName(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #ddd', marginBottom: 14, fontSize: 15 }} />
          </div>
          <div style={{ width: 80 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Nr</label>
            <input value={shirtNumber} onChange={e => setShirtNumber(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #ddd', marginBottom: 14, fontSize: 15 }} />
          </div>
          <div style={{ width: 120 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Titel</label>
            <input value={roleTitle} onChange={e => setRoleTitle(e.target.value)} placeholder="bv. Coach"
              style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #ddd', marginBottom: 14, fontSize: 15 }} />
          </div>
        </div>
      )}
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Profielfoto</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div className="yof-photo-tile">
          {(photoPreview || player.photo_url)
            ? <img src={photoPreview || player.photo_url} alt="" />
            : <div className="no-photo">{roleTitle || (shirtNumber !== '' ? shirtNumber : '?')}</div>}
          {(roleTitle || shirtNumber !== '') && <span className="shirt-badge">{roleTitle || shirtNumber}</span>}
        </div>
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
          {uploadingPhoto ? 'Foto uploaden...' : (adminMode ? 'Opslaan' : 'Opslaan (ter controle)')}
        </button>
      </div>
      {!adminMode && (
        <p style={{ fontSize: 12, color: '#999', textAlign: 'center', marginTop: 10 }}>
          Wijzigingen verschijnen pas online na goedkeuring door de teammanager.
        </p>
      )}
    </>
  )

  if (adminMode) {
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ fontSize: 15, margin: 0 }}>Profiel bewerken</h3>
          <button onClick={onCancel} style={{ fontSize: 12, cursor: 'pointer' }}>&larr; terug</button>
        </div>
        {formFields}
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
        {formFields}
      </div>
    </div>
  )
}
