import { useFetch } from '@core/useFetch.js'

export function useTracks() {
  const { data, loading, error, reload } = useFetch('/api/mixmusic/tracks')
  return { tracks: data ?? [], loading, error, reload }
}
