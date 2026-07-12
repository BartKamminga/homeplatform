import { api } from '../../core/api.js'

export const getTree         = ()        => api.get('/api/beatcrades/tree')
export const createSection   = (body)    => api.post('/api/beatcrades/sections', body)
export const updateSection   = (id, b)   => api.patch(`/api/beatcrades/sections/${id}`, b)
export const deleteSection   = (id)      => api.delete(`/api/beatcrades/sections/${id}`)
export const createRack      = (body)    => api.post('/api/beatcrades/racks', body)
export const updateRack      = (id, b)   => api.patch(`/api/beatcrades/racks/${id}`, b)
export const deleteRack      = (id)      => api.delete(`/api/beatcrades/racks/${id}`)
export const createCrade     = (body)    => api.post('/api/beatcrades/crades', body)
export const updateCrade     = (id, b)   => api.patch(`/api/beatcrades/crades/${id}`, b)
export const deleteCrade     = (id)      => api.delete(`/api/beatcrades/crades/${id}`)
export const restartCrade    = (id)      => api.post(`/api/beatcrades/crades/${id}/restart`, {})
export const cancelCrade     = (id)      => api.post(`/api/beatcrades/crades/${id}/cancel`,  {})
export const syncPreview     = ()        => api.get('/api/beatcrades/sync/preview')
export const syncExecute     = (ids)     => api.post('/api/beatcrades/sync/execute', { action_ids: ids })

export const getProvider     = ()        => api.get('/api/admin/beatport-provider')
export const setProvider     = (provider) => api.put('/api/admin/beatport-provider', { provider })
