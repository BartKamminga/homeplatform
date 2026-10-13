// HomePlatform-variant van VBT.storage: ritten en profiel per gebruiker op de server (/api/vbt).
// Zelfde async functies als storage.js; daarnaast VBT.strava voor koppelen en uploaden.
import { api } from '@core/api.js'

const enc = encodeURIComponent

VBT.storage = {
  async saveRide(ride) {
    const body = Object.assign({}, ride)
    delete body.id
    const saved = await api.post('/api/vbt/rides', body)
    return Object.assign({}, saved, { serverId: saved.id })
  },
  listRides: () => api.get('/api/vbt/rides?limit=200'),
  async getSamples(id) { return (await api.get('/api/vbt/rides/' + enc(id))).samples },
  getRide: id => api.get('/api/vbt/rides/' + enc(id)),
  deleteRide: id => api.delete('/api/vbt/rides/' + enc(id)),
  listTrash: () => api.get('/api/vbt/rides-trash'),
  restoreRide: id => api.post('/api/vbt/rides/' + enc(id) + '/restore'),
  liveSync: body => api.post('/api/vbt/rides/live', body),
  bestLap: course => api.get('/api/vbt/rides/best-lap?course=' + enc(course)),
  async markPb() { /* de server bepaalt zelf of een rit een PB is */ },
  async loadProfile() {
    const p = await api.get('/api/vbt/profile')
    return { ftp: p.ftp, planSlug: p.planSlug, startDate: p.planStart, done: p.planDone }
  },
  saveProfile: state => api.put('/api/vbt/profile', { ftp: state.ftp, planSlug: state.planSlug, planStart: state.startDate, planDone: state.done }),
  listPlans: () => api.get('/api/vbt/plans'),
  loadPlan: slug => api.get('/api/vbt/plans/' + enc(slug)),
  listWorkouts: () => api.get('/api/vbt/workouts'),
  getWorkout: id => api.get('/api/vbt/workouts/' + enc(id)),
  deleteWorkout: id => api.delete('/api/vbt/workouts/' + enc(id)),
  async importZwo(files) {
    const form = new FormData()
    for (const f of files) form.append('files', f, f.name)
    return authUpload('/api/vbt/workouts/import', form)
  },
}

// multipart-upload met de JWT (api.js doet alleen JSON)
async function authUpload(path, form) {
  const res = await fetch(path, { method: 'POST', headers: { Authorization: 'Bearer ' + localStorage.getItem('hp_token') }, body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Upload mislukt (' + res.status + ')')
  return data
}

VBT.strava = {
  status: () => api.get('/api/vbt/strava'),
  async connectUrl() { return (await api.get('/api/vbt/strava/connect')).url },
  disconnect: () => api.delete('/api/vbt/strava'),
  uploadStatus: rideId => api.get('/api/vbt/rides/' + enc(rideId) + '/strava'),
  // multipart (FIT-bytes)
  async upload(rideId, fitBytes, fileName) {
    const form = new FormData()
    form.append('fit', new Blob([fitBytes], { type: 'application/octet-stream' }), fileName)
    form.append('description', 'Ridden in VBT - Virtual Bike Trainer')
    return authUpload('/api/vbt/rides/' + enc(rideId) + '/strava', form)
  },
}
