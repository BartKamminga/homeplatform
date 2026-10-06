const STORAGE_KEY = 'yof_team_code'

export const getStoredCode = () => localStorage.getItem(STORAGE_KEY) || ''
export const storeCode     = (code) => localStorage.setItem(STORAGE_KEY, code)
export const clearCode     = () => localStorage.removeItem(STORAGE_KEY)

// Wedstrijdlink (item 1186): de link-code zelf is het toegangstoken voor die
// ene pagina. Alleen in geheugen, bewust niet als teamcode opgeslagen - anders
// zou een wedstrijdlink alsnog de hele site ontsluiten.
let scopedCode = ''
export const setScopedCode = (code) => { scopedCode = code || '' }
export const getActiveCode = () => scopedCode || getStoredCode()
