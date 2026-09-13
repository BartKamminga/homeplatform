import { useState, useEffect } from 'react'
import { getRoadmapItems } from '../api.js'

const STATUS_ORDER = ["deploying", "on_acc", "in_progress", "ready", "pick_up", "analyzed", "idea", "done"]
const STATUS_LABEL = {
  idea: "Idea", analyzed: "Analyzed", pick_up: "Pick up", in_progress: "In progress",
  ready: "Ready to deploy", on_acc: "On acc", deploying: "Deploying", done: "Done",
}
const STATUS_COLOR = {
  idea: "#888", analyzed: "#8b5cf6", pick_up: "#0ea5e9", in_progress: "#12203c",
  ready: "#d97706", on_acc: "#f97316", deploying: "#dc2626", done: "#16a34a",
}

export default function RoadmapAdmin() {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    getRoadmapItems().then(setItems).catch(e => setError(e.message))
  }, [])

  const sorted = [...items].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))

  return (
    <div>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Roadmap — dit project</h3>
      {error && <p style={{ color: '#c23b3b', fontSize: 13 }}>{error}</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#888' }}>
            <th style={{ padding: 6 }}>#</th>
            <th style={{ padding: 6 }}>Titel</th>
            <th style={{ padding: 6 }}>Status</th>
            <th style={{ padding: 6 }}>Prioriteit</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(it => (
            <tr key={it.id} style={{ borderTop: '1px solid #eee' }}>
              <td style={{ padding: 6, color: '#999' }}>{it.id}</td>
              <td style={{ padding: 6 }}>{it.title}</td>
              <td style={{ padding: 6 }}>
                <span style={{ color: STATUS_COLOR[it.status] || '#888', fontWeight: 600 }}>
                  {STATUS_LABEL[it.status] || it.status}
                </span>
              </td>
              <td style={{ padding: 6 }}>{it.priority}</td>
            </tr>
          ))}
          {sorted.length === 0 && !error && (
            <tr><td colSpan={4} style={{ padding: 6, color: '#666' }}>Geen items gevonden.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
