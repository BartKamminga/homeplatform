import { useState, useEffect, useMemo, useCallback } from 'react'
import { COMP_ORDER, COMP_LABELS_LONG, IS_O16, POULE_ORDER_14, POULE_ORDER_16, DATA_URLS, getSavedClub, saveClub, getSavedComp, saveComp, getSavedFocus, saveFocus } from '../constants'
import { parseO14, parseO16, findMyTeam, getAllClubs } from './parsers'

export function useCompetitionData() {
  const [comps, setComps] = useState(null)
  const [activeComp, setActiveComp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState(null)
  const [focusClub, setFocusClub] = useState(getSavedClub)
  const [focusMode, _setFocusMode] = useState(getSavedFocus)
  const setFocusMode = (v) => { _setFocusMode(v); saveFocus(v) }

  const fetchFromServer = useCallback(() => {
    setLoading(true)
    const merged = {}
    const promises = DATA_URLS.map(url =>
      fetch(url + '?t=' + Date.now())
        .then(r => r.ok ? r.text() : null)
        .then(raw => {
          if (!raw) return
          let parsed = parseO16(raw)
          if (Object.keys(parsed).length === 0) parsed = parseO14(raw)
          for (const t in parsed) {
            if (!merged[t]) merged[t] = {}
            Object.assign(merged[t], parsed[t])
          }
        }).catch(() => {})
    )
    Promise.all(promises).then(() => {
      if (Object.keys(merged).length > 0) {
        setComps(merged)
        const saved = getSavedComp()
        const first = saved && merged[saved] ? saved : COMP_ORDER.find(k => merged[k])
        setActiveComp(prev => first || (prev && merged[prev] ? prev : Object.keys(merged)[0]))
        if (first) saveComp(first)
        setDataSource('server')
      }
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    fetchFromServer()
  }, [fetchFromServer])

  const types = useMemo(() => (comps ? COMP_ORDER.filter(k => comps[k]) : []), [comps])

  const visibleTypes = useMemo(() => {
    if (!comps || !focusMode || !focusClub) return types
    return types.filter(type => {
      const comp = comps[type]
      return Object.values(comp).some(poule => poule.teams?.includes(focusClub))
    })
  }, [comps, focusMode, focusClub, types])

  const effectiveComp = useMemo(() => {
    if (!comps) return null
    if (focusMode && visibleTypes.indexOf(activeComp) < 0 && visibleTypes.length > 0) return visibleTypes[0]
    return activeComp
  }, [comps, focusMode, visibleTypes, activeComp])

  const data = useMemo(() => (effectiveComp ? comps[effectiveComp] || {} : {}), [comps, effectiveComp])

  const filteredData = useMemo(() => {
    if (!focusMode || !focusClub) return data
    const filtered = {}
    for (const pouleId in data) {
      const poule = data[pouleId]
      if (poule.teams?.includes(focusClub)) filtered[pouleId] = poule
    }
    return filtered
  }, [data, focusMode, focusClub])

  const label = useMemo(() => (effectiveComp ? COMP_LABELS_LONG[effectiveComp] || effectiveComp : ''), [effectiveComp])

  const myTeam = useMemo(() => (focusClub && comps && findMyTeam(comps, focusClub)) ? focusClub : null, [comps, focusClub])
  const o16 = useMemo(() => IS_O16(effectiveComp), [effectiveComp])
  const pouleOrder = useMemo(() => (o16 ? POULE_ORDER_16 : POULE_ORDER_14), [o16])
  const allClubs = useMemo(() => (comps ? getAllClubs(comps) : []), [comps])

  const setActiveCompetition = useCallback((type) => {
    saveComp(type)
    setActiveComp(type)
  }, [])

  const setFocusClubAndSave = useCallback((club) => {
    saveClub(club)
    setFocusClub(club)
  }, [])

  return {
    comps,
    activeComp,
    loading,
    dataSource,
    focusClub,
    focusMode,
    types,
    visibleTypes,
    effectiveComp,
    data,
    filteredData,
    label,
    myTeam,
    o16,
    pouleOrder,
    allClubs,
    fetchFromServer,
    setActiveCompetition,
    setFocusClub: setFocusClubAndSave,
    setFocusMode,
  }
}
