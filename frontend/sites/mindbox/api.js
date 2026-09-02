import { api } from '@core/api.js'
import { reportError } from '@core/sentry.js'

// ---------------------------------------------------------------------------
// Items (geüploade bestanden)
// ---------------------------------------------------------------------------

export function listItems(caseId) {
  const query = caseId ? `?case_id=${encodeURIComponent(caseId)}` : ''
  return api.get(`/api/mindbox/items${query}`)
}

export async function uploadItem(file, caseId) {
  const token = localStorage.getItem('hp_token')
  const formData = new FormData()
  formData.append('file', file, file.name)
  const query = caseId ? `?case_id=${encodeURIComponent(caseId)}` : ''
  const res = await fetch(`/api/mindbox/items${query}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) {
    let detail = 'Upload mislukt'
    try { detail = (await res.json()).detail || detail } catch { /* geen JSON-body */ }
    const error = new Error(detail)
    reportError(error, { 'api.path': '/api/mindbox/items', 'api.status': res.status })
    throw error
  }
  return res.json()
}

export function updateItem(id, data) {
  return api.patch(`/api/mindbox/items/${id}`, data)
}

export function deleteItem(id) {
  return api.delete(`/api/mindbox/items/${id}`)
}

export async function downloadItem(id, filename) {
  const token = localStorage.getItem('hp_token')
  const res = await fetch(`/api/mindbox/items/${id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Downloaden mislukt')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'bestand'
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Cases (container die items/responses aan elkaar koppelt)
// ---------------------------------------------------------------------------

export function listCases() {
  return api.get('/api/mindbox/cases')
}

export function createCase(data) {
  return api.post('/api/mindbox/cases', data)
}

export function updateCase(id, data) {
  return api.patch(`/api/mindbox/cases/${id}`, data)
}

export function deleteCase(id) {
  return api.delete(`/api/mindbox/cases/${id}`)
}

export function listCaseEvents(caseId) {
  return api.get(`/api/mindbox/cases/${caseId}/events`)
}

export function addCaseEvent(caseId, data) {
  return api.post(`/api/mindbox/cases/${caseId}/events`, data)
}

// ---------------------------------------------------------------------------
// Contexts (herbruikbare instructie-/persona-tekst)
// ---------------------------------------------------------------------------

export function listContexts() {
  return api.get('/api/mindbox/contexts')
}

export function createContext(data) {
  return api.post('/api/mindbox/contexts', data)
}

export function updateContext(id, data) {
  return api.patch(`/api/mindbox/contexts/${id}`, data)
}

export function deleteContext(id) {
  return api.delete(`/api/mindbox/contexts/${id}`)
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export function listResponses(caseId) {
  const query = caseId ? `?case_id=${encodeURIComponent(caseId)}` : ''
  return api.get(`/api/mindbox/responses${query}`)
}

export function createResponse(data) {
  return api.post('/api/mindbox/responses', data)
}
