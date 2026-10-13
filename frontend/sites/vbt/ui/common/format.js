// Notatie en kleine helpers die meerdere secties delen
import { actions } from '../hooks/useVbt.js'
import { confirmDialog } from './ConfirmDialog.jsx'

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export const fmtDur = s => {
  s = Math.max(0, Math.round(s || 0))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0')
}
export const minutes = s => Math.round((s || 0) / 60) + ' MIN'
export const dayLabel = d => DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]
export const fmtDateTime = isoStr => {
  const d = new Date(isoStr)
  return dayLabel(d) + ' ' + d.getFullYear() + ' · ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}
export const parseIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }

// starten vanuit het menu: tijdens een rit eerst vragen (de lopende rit wordt dan eerst bewaard)
export async function startWithConfirm(what, start) {
  if (actions().riding() && !(await confirmDialog({ title: 'END THIS RIDE?', text: 'Start ' + what + ' instead? Your current ride is saved.', yes: 'START' }))) return false
  start()
  return true
}
