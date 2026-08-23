import { api } from '@core/api.js'

export const listAgents        = () => api.get('/api/agent-control/agents')
export const toggleAgent       = (agentKey) => api.post(`/api/agent-control/agents/${agentKey}/toggle`, {})

export const listContexts      = (agentKey) => api.get(`/api/agent-control/contexts?agent_key=${encodeURIComponent(agentKey)}`)

export const listNotifications = () => api.get('/api/agent-control/notifications')
export const markNotificationRead = (id) => api.post(`/api/agent-control/notifications/${id}/read`, {})

export const listTasks   = (agentKey) => api.get(`/api/agent-control/tasks?agent_key=${encodeURIComponent(agentKey)}`)
export const addTask     = (agentKey, instruction, contextKey, params) =>
  api.post('/api/agent-control/tasks', { agent_key: agentKey, instruction, context_key: contextKey || null, params: params || {} })

export const getKnowledge = (agentKey) => api.get(`/api/agent-control/agents/${agentKey}/knowledge`)
export const getRunLog    = (agentKey) => api.get(`/api/agent-control/agents/${agentKey}/log`)
