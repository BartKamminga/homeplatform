import React, { useState } from 'react'
import Popup from '../common/Popup'
import { VERSION } from '../../constants'

const EMOJIS = [['😍','Top!'],['😊','Leuk'],['😐','Mwah'],['😤','Bah'],['🤯','Wauw']]

export default function FeedbackPopup({ onClose }) {
  const [emoji, setEmoji] = useState(null)
  const [text, setText] = useState('')

  function submit() {
    const title = emoji ? `Feedback: ${emoji}` : 'Feedback'
    const body = [emoji && `Rating: ${emoji}`, text.trim(), '---', `v${VERSION} · ${new Date().toLocaleString('nl-NL')}`].filter(Boolean).join('\n\n')
    window.open(`https://github.com/BartKamminga/nk-hockey/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`, '_blank')
    onClose()
  }

  return (
    <Popup title="💬 Feedback" onClose={onClose} maxWidth={420}>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: 13, marginBottom: 12, color: 'var(--text-secondary)' }}>Hoe vind je deze website?</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
          {EMOJIS.map(([e, label]) => (
            <div key={e} onClick={() => setEmoji(e)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', padding: '8px 10px', borderRadius: 8,
              background: emoji === e ? '#dbeafe' : 'transparent', border: emoji === e ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'all .15s',
            }}>
              <span style={{ fontSize: 28 }}>{e}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>
            </div>
          ))}
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder="Idee? Bug? Klacht over je doelsaldo?"
          style={{ width: '100%', minHeight: 70, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans',sans-serif", resize: 'vertical', boxSizing: 'border-box' }} />
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <button className="run-btn" style={{ padding: '8px 24px', fontSize: 13 }}
            disabled={!emoji && !text.trim()} onClick={submit}>
            Backhand in de kruising 🏑
          </button>
        </div>
      </div>
    </Popup>
  )
}
