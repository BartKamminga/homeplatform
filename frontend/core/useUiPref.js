import { useState, useEffect } from 'react'
import { loadUiPrefs, setUiPref } from './uiPrefs.js'

/**
 * Persistent UI preference synced to user_preferences.extra on the backend.
 * Reads from localStorage immediately (no flash), then syncs from server on mount.
 *
 * @param {string}   key      Storage key, used for both localStorage and backend
 * @param {*}        fallback Default value when no stored value exists
 * @param {Function} coerce   Optional type cast applied to the stored string value
 * @returns {[value, update]}
 */
export function useUiPref(key, fallback, coerce) {
  const [value, setValue] = useState(() => {
    const ls = localStorage.getItem(key)
    if (ls === null) return fallback
    return coerce ? coerce(ls) : ls
  })

  useEffect(() => {
    loadUiPrefs().then(prefs => {
      const raw = prefs[key]
      if (raw !== undefined && raw !== null) {
        setValue(coerce ? coerce(raw) : raw)
        localStorage.setItem(key, String(raw))
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function update(newValue) {
    setValue(newValue)
    localStorage.setItem(key, String(newValue))
    setUiPref(key, newValue)
  }

  return [value, update]
}
