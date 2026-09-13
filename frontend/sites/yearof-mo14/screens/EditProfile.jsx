import { useState, useEffect } from 'react'
import { getProfileLinkContext, submitPlayerEdit } from '../api.js'

export default function EditProfile({ code }) {
  const [player, setPlayer] = useState(null)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [nickname, setNickname] = useState('')
  const [position, setPosition] = useState('')
  const [bio, setBio] = useState('')
  const [funFacts, setFunFacts] = useState('')

  useEffect(() => {
    getProfileLinkContext(code).then(p => {
      setPlayer(p)
      setNickname(p.nickname || '')
      setPosition(p.position || '')
      setBio(p.bio || '')
      setFunFacts(p.fun_facts || '')
    }).catch(e => setError(e.message))
  }, [code])

  async function submit() {
    try {
      await submitPlayerEdit({
        profile_link_code: code,
        nickname: nickname || null,
        position: position || null,
        bio: bio || null,
        fun_facts: funFacts || null,
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
  if (!player) return null

  if (sent) {
    return (
      <div className="yof yof-gate">
        <div className="yof-gate-card">
          <div style={{ fontSize: 32 }}>🎉</div>
          <h1 style={{ fontSize: 18 }}>Bedankt!</h1>
          <p style={{ fontSize: 14, color: '#666' }}>
            Je wijzigingen zijn verstuurd en verschijnen op je profiel zodra de teammanager ze heeft goedgekeurd.
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
          <h1 style={{ fontSize: 18 }}>Hoi {player.nickname || player.name}, dit is jouw profiel</h1>
          <p>Werk je gegevens bij wanneer je maar wilt.</p>
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

        <button className="yof-btn" onClick={submit}>Opslaan (ter controle)</button>
        <p style={{ fontSize: 12, color: '#999', textAlign: 'center', marginTop: 10 }}>
          Wijzigingen verschijnen pas online na goedkeuring door de teammanager.
        </p>
      </div>
    </div>
  )
}
