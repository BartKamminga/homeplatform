// frontend/sites/dontforget/src/api.js
// DontForget API helpers

import { api } from '@core/api.js'
import { reportError } from '@core/sentry.js'

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

async function _upload(file, name, category = 'dontforget') {
  const token = localStorage.getItem('hp_token')
  const formData = new FormData()
  formData.append('file', file, name)
  formData.append('category', category)
  const res = await fetch('/api/uploads', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) {
    const error = new Error(res.status === 401 ? 'Sessie verlopen, log opnieuw in' : 'Upload mislukt')
    reportError(error, { 'api.path': '/api/uploads', 'api.status': res.status })
    throw error
  }
  return res.json()
}

export function uploadPhoto(file, category = 'dontforget') {
  return _upload(file, file.name || 'photo.jpg', category)
}

export function uploadAudio(blob, category = 'dontforget') {
  const ext = blob.type.includes('ogg') ? '.ogg'
    : blob.type.includes('mp4') ? '.mp4'
    : blob.type.includes('wav') ? '.wav'
    : '.webm'
  return _upload(blob, `recording${ext}`, category)
}

// ---------------------------------------------------------------------------
// Taken
// ---------------------------------------------------------------------------

export function listTasks(done) {
  const query = done !== undefined ? `?done=${done}` : ''
  return api.get(`/api/dontforget/tasks${query}`)
}

export function createTask(data) {
  return api.post('/api/dontforget/tasks', data)
}

export function updateTask(id, data) {
  return api.patch(`/api/dontforget/tasks/${id}`, data)
}

export function completeTask(id) {
  return api.post(`/api/dontforget/tasks/${id}/complete`)
}

export function deleteTask(id) {
  return api.delete(`/api/dontforget/tasks/${id}`)
}
