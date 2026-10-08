import { useState, useEffect } from 'react'

// Studio (preview + bewerkpaneel naast elkaar) alleen op een groot scherm.
const QUERY = '(min-width: 1200px)'

export default function useWideScreen() {
  const [wide, setWide] = useState(() => window.matchMedia(QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = e => setWide(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return wide
}
