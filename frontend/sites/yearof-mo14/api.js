import { api } from '@core/api.js'

export const getStatus = () => api.get('/api/yearof-mo14/status')
export const getMe     = () => api.get('/api/yearof-mo14/me')
