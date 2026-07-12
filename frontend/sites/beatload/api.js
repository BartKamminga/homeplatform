import { api } from '../../core/api.js'

export const submitDownload  = (body)     => api.post('/api/beatload/download', body)
export const listJobs        = ()         => api.get('/api/beatload/jobs')
export const deleteJob       = (id)       => api.delete(`/api/beatload/jobs/${id}`)

export const getProvider     = ()         => api.get('/api/admin/beatport-provider')
export const setProvider     = (provider) => api.put('/api/admin/beatport-provider', { provider })
