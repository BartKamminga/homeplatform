// frontend/sites/dontforget/src/api.js
// DontForget API helpers

import { api } from '@core/api.js'

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

export async function uploadPhoto(file, category = 'dontforget') {
  const token = localStorage.getItem('hp_token')
  const formData = new FormData()
  formData.append('file', file)
  formData.append('category', category)
  const res = await fetch('/api/uploads', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) throw new Error('Upload mislukt')
  return res.json()
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
