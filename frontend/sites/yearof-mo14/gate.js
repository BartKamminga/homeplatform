const STORAGE_KEY = 'yof_team_code'

// Publieke site vereist sinds 2026-09-13 geen teamcode meer (zie App.jsx) -
// dit blijft alleen bestaan omdat foto-upload een code nog optioneel als
// attributie accepteert als iemand toevallig nog een oud teamlinkje heeft.
export const getStoredCode = () => localStorage.getItem(STORAGE_KEY) || ''
