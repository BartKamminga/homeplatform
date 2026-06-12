import { api } from './api.js'

let _cache = null
let _promise = null

export function loadUiPrefs() {
  if (_cache !== null) return Promise.resolve(_cache)
  if (_promise) return _promise
  _promise = api.get('/api/auth/me/ui-prefs')
    .then(data => { _cache = data ?? {}; _promise = null; return _cache })
    .catch(() => { _promise = null; return {} })
  return _promise
}

export function setUiPref(key, value) {
  if (_cache) _cache[key] = value
  api.patch('/api/auth/me/ui-prefs', { [key]: value }).catch(() => {})
}
