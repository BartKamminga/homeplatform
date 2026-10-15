import { api } from '@core/api.js'
import { reportError } from '@core/sentry.js'

const BASE = '/api/dossiers'
const enc = encodeURIComponent

export const listDossiers = () => api.get(BASE)
export const getDossier = (id) => api.get(`${BASE}/${enc(id)}`)
export const createDossier = (name) => api.post(BASE, { name })
export const updateDossier = (id, data) => api.patch(`${BASE}/${enc(id)}`, data)

export function listEntries(id, { q, kind, review } = {}) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (kind) params.set('kind', kind)
  if (review) params.set('review', review)
  const query = params.toString() ? `?${params}` : ''
  return api.get(`${BASE}/${enc(id)}/entries${query}`)
}

export const addEntry = (id, data) => api.post(`${BASE}/${enc(id)}/entries`, data)
export const updateEntry = (entryId, data) => api.patch(`${BASE}/entries/${enc(entryId)}`, data)
export const deleteEntry = (entryId) => api.delete(`${BASE}/entries/${enc(entryId)}`)
export const reviewEntry = (entryId, decision) => api.post(`${BASE}/entries/${enc(entryId)}/review`, { decision })
export const searchAll = (q) => api.get(`${BASE}/search?q=${enc(q)}`)

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('hp_token')}` }
}

// Multipart upload van meerdere bestanden tegelijk; per bestand een resultaat of fout.
export async function uploadFiles(id, files) {
  const form = new FormData()
  for (const file of files) form.append('uploads', file, file.name)
  const path = `${BASE}/${enc(id)}/upload`
  const res = await fetch(path, { method: 'POST', headers: authHeader(), body: form })
  if (!res.ok) {
    let detail = 'Upload failed'
    try { detail = (await res.json()).detail || detail } catch { /* geen JSON */ }
    const error = new Error(detail)
    reportError(error, { 'api.path': path, 'api.status': res.status })
    throw error
  }
  return res.json()
}

export async function downloadEntry(entry) {
  const res = await fetch(`${BASE}/entries/${enc(entry.id)}/download`, { headers: authHeader() })
  if (!res.ok) throw new Error('Download failed')
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = entry.original_filename || 'file'
  a.click()
  URL.revokeObjectURL(url)
}
