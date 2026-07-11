import { api } from '../../core/api.js'

export const getTree        = ()        => api.get('/api/beatcrades/tree')
export const createGroup    = (body)    => api.post('/api/beatcrades/groups', body)
export const updateGroup    = (id, b)   => api.patch(`/api/beatcrades/groups/${id}`, b)
export const deleteGroup    = (id)      => api.delete(`/api/beatcrades/groups/${id}`)
export const createCrade    = (body)    => api.post('/api/beatcrades/crades', body)
export const updateCrade    = (id, b)   => api.patch(`/api/beatcrades/crades/${id}`, b)
export const deleteCrade    = (id)      => api.delete(`/api/beatcrades/crades/${id}`)
