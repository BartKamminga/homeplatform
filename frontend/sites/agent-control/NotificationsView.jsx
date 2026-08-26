import { useEffect, useState } from 'react'
import { listNotifications, markNotificationRead } from './api.js'
import * as s from './styles.js'

export default function NotificationsView({ onError, lockedAgentKey }) {
  const [notifications, setNotifications] = useState(null)

  function refresh() {
    listNotifications().then(setNotifications).catch(err => onError(err.message))
  }

  useEffect(refresh, [])

  function handleRead(id) {
    markNotificationRead(id).then(refresh).catch(err => onError(err.message))
  }

  const items = lockedAgentKey ? (notifications?.items || []).filter(n => n.agent_key === lockedAgentKey) : notifications?.items
  const unreadCount = lockedAgentKey ? items?.filter(n => !n.read_at).length : notifications?.unread_count

  return (
    <div>
      <div style={s.topbar}>
        <h2 style={s.h2}>Meldingen {unreadCount > 0 && `(${unreadCount} ongelezen)`}</h2>
      </div>
      <div style={s.panel}>
        {!notifications && <p>Laden...</p>}
        {notifications && items.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Geen meldingen.</p>}
        {notifications && items.map(n => (
          <div key={n.id} style={{
            display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '8px 0',
            borderBottom: '1px solid var(--color-border)', opacity: n.read_at ? 0.5 : 1,
          }}>
            <span>{!lockedAgentKey && `[${n.agent_key}] `}{n.message}</span>
            {!n.read_at && <button onClick={() => handleRead(n.id)}>Gelezen</button>}
          </div>
        ))}
      </div>
    </div>
  )
}
