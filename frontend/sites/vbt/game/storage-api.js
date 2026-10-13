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
  listRides: () => api.get('/api/vbt/rides'),
  async getSamples(id) { return (await api.get('/api/vbt/rides/' + enc(id))).samples },
  getRide: id => api.get('/api/vbt/rides/' + enc(id)),
  bestLap: course => api.get('/api/vbt/rides/best-lap?course=' + enc(course)),
  async markPb() { /* de server bepaalt zelf of een rit een PB is */ },
  async loadProfile() {
    const p = await api.get('/api/vbt/profile')
    return { ftp: p.ftp, startDate: p.planStart, done: p.planDone }
  },
  saveProfile: state => api.put('/api/vbt/profile', { ftp: state.ftp, planStart: state.startDate, planDone: state.done }),
}

VBT.strava = {
  status: () => api.get('/api/vbt/strava'),
  async connectUrl() { return (await api.get('/api/vbt/strava/connect')).url },
  disconnect: () => api.delete('/api/vbt/strava'),
  uploadStatus: rideId => api.get('/api/vbt/rides/' + enc(rideId) + '/strava'),
  // multipart (FIT-bytes); api.js doet alleen JSON, dus hier zelf de JWT meesturen
  async upload(rideId, fitBytes, fileName) {
    const form = new FormData()
    form.append('fit', new Blob([fitBytes], { type: 'application/octet-stream' }), fileName)
    form.append('description', 'Ridden in VBT - Virtual Bike Trainer')
    const res = await fetch('/api/vbt/rides/' + enc(rideId) + '/strava', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + localStorage.getItem('hp_token') },
      body: form,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.detail || 'Upload mislukt (' + res.status + ')')
    return data
  },
}
