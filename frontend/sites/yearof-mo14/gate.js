const STORAGE_KEY = 'yof_team_code'

export const getStoredCode = () => localStorage.getItem(STORAGE_KEY) || ''
export const storeCode     = (code) => localStorage.setItem(STORAGE_KEY, code)
export const clearCode     = () => localStorage.removeItem(STORAGE_KEY)
