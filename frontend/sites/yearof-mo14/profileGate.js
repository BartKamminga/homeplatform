const PREFIX = 'yof_profile_code_'

export const storeProfileCode = (playerId, code) => localStorage.setItem(PREFIX + playerId, code)
export const getStoredProfileCode = (playerId) => localStorage.getItem(PREFIX + playerId) || ''
