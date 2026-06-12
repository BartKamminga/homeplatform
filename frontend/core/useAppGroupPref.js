import { useState, useEffect } from 'react'
import { api } from './api.js'

export function useAppGroupPref(app) {
  const [groups,  setGroups]  = useState([])
  const [current, setCurrent] = useState(null)
  const [loading, setLoading] = useState(false)
  const prefKey = `pref_group_${app}`

  useEffect(() => {
    api.get('/api/auth/me')
      .then(data => {
        setGroups(data.group_details ?? [])
        setCurrent(data[prefKey] ?? null)
      })
      .catch(() => {})
  }, [])

  async function setGroup(slug) {
    setLoading(true)
    try {
      await api.patch('/api/auth/me/preferences', { [prefKey]: slug || null })
      // Reload zodat de backend data voor de nieuwe groep ophaalt
      window.location.reload()
    } catch {
      setLoading(false)
    }
  }

  return { groups, current, setGroup, loading }
}
