import React from 'react'
import { getTeamForm } from '../../lib/utils'

function formColor(pts) {
  if (pts >= 12) return '#16a34a'
  if (pts >= 9) return '#65a30d'
  if (pts >= 5) return '#d97706'
  return '#dc2626'
}

export default function FormBadge({ form }) {
  if (!form || form.length === 0) return null
  const pts = form.reduce((s, r) => s + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0)
  const col = formColor(pts)
  const title = form.map(r => r === 'W' ? 'W' : r === 'D' ? 'G' : 'V').join('') + ` (${pts}/${form.length * 3})`
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 16, height: 16, borderRadius: '50%', background: col,
      color: '#fff', fontSize: 8, fontWeight: 700, fontFamily: "'DM Mono',monospace",
    }} title={title}>{pts}</span>
  )
}

export { getTeamForm }
