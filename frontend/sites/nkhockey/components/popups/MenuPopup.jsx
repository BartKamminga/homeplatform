import React from 'react'
import Popup from '../common/Popup'
import { ChangelogContent } from '../../changelog'
import { VERSION } from '../../constants'

export default function MenuPopup({ onClose, onShowDisclaimer, onShowFeedback, onShowHelp, onReload }) {
  return (
    <Popup title={`🏑 NK Hockey v${VERSION}`} onClose={onClose}>
      <div style={{ marginBottom: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="reload-btn" onClick={() => { onReload(); onClose() }} style={{ fontSize: 12, padding: '6px 12px' }}>↻ Herlaad</button>
        <button className="reload-btn" onClick={() => { onClose(); onShowDisclaimer() }} style={{ fontSize: 12, padding: '6px 12px' }}>ℹ️ Over</button>
        <button className="reload-btn" onClick={() => { onClose(); onShowFeedback() }} style={{ fontSize: 12, padding: '6px 12px' }}>💬 Feedback</button>
        <button className="reload-btn" onClick={() => { onClose(); onShowHelp() }} style={{ fontSize: 12, padding: '6px 12px' }}>❓ Uitleg</button>
      </div>
      <ChangelogContent />
    </Popup>
  )
}
