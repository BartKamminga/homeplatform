// Client-side onthouden welke berichten/fotos deze bezoeker al een hartje
// gaf - geen accounts, dus geen server-side dedupe (zelfde vertrouwensmodel
// als de rest van deze anonieme site). Simpelweg voorkomt dit dat 1 tikje op
// het hartje meerdere keren geteld wordt.
const STORAGE_KEY = 'yof_likes'

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function likeKey(kind, id) {
  return `${kind}:${id}`
}

export function isLiked(kind, id) {
  return readAll().includes(likeKey(kind, id))
}

export function setLiked(kind, id, liked) {
  const key = likeKey(kind, id)
  const all = readAll()
  const next = liked ? [...new Set([...all, key])] : all.filter(k => k !== key)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}
