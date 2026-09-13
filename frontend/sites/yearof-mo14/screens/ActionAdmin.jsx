import { useState, useEffect } from 'react'
import { getActionSettings, updateActionSettings } from '../api.js'

export default function ActionAdmin() {
  const [goalAmount, setGoalAmount] = useState(4000)
  const [raisedAmount, setRaisedAmount] = useState(0)
  const [donationUrl, setDonationUrl] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getActionSettings().then(s => {
      setGoalAmount(s.goal_amount)
      setRaisedAmount(s.raised_amount)
      setDonationUrl(s.donation_url || '')
    }).catch(e => setError(e.message))
  }, [])

  async function save() {
    try {
      await updateActionSettings({
        goal_amount: Number(goalAmount) || 0,
        raised_amount: Number(raisedAmount) || 0,
        donation_url: donationUrl || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Actie-instellingen</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}

      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, margin: '0 0 4px' }}>Doelbedrag (&euro;)</label>
      <input type="number" value={goalAmount} onChange={e => setGoalAmount(e.target.value)}
        style={{ padding: 6, fontSize: 13, marginBottom: 10, width: 120 }} />

      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, margin: '0 0 4px' }}>Opgehaald bedrag (&euro;)</label>
      <input type="number" value={raisedAmount} onChange={e => setRaisedAmount(e.target.value)}
        style={{ padding: 6, fontSize: 13, marginBottom: 10, width: 120 }} />

      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, margin: '0 0 4px' }}>Donatielink (optioneel, bv. een Tikkie)</label>
      <input value={donationUrl} onChange={e => setDonationUrl(e.target.value)} placeholder="https://tikkie.me/pay/..."
        style={{ padding: 6, fontSize: 13, marginBottom: 10, width: 300, maxWidth: '100%' }} />

      <div>
        <button onClick={save} style={{ fontSize: 13, cursor: 'pointer' }}>Opslaan</button>
        {saved && <span style={{ marginLeft: 8, fontSize: 12, color: '#16a34a' }}>Opgeslagen!</span>}
      </div>
      <p style={{ fontSize: 11, color: '#999', marginTop: 10 }}>
        Opgehaald bedrag werk je zelf bij naarmate er gedoneerd wordt - geen automatische koppeling met de donatielink.
      </p>
    </div>
  )
}
