import { useState, useEffect, useMemo } from 'react'
import { uploadPhoto } from '../../api.js'
import { compressImage } from '../../compressImage.js'

// Bestanden verzamelen (kiezen + plakken met Ctrl+V), previews (met
// opruimen van object-URL's), comprimeren en uploaden met voortgang en een
// foutmelding per bestand. Basis voor alle uploadflows (item 1213 / 1210).
export default function useUploadQueue({ enablePaste = true } = {}) {
  const [files, setFiles] = useState([])
  const [progress, setProgress] = useState(null) // { done, total }
  const [errors, setErrors] = useState([])

  const previews = useMemo(() => files.map(f => ({ file: f, url: URL.createObjectURL(f), isVideo: f.type.startsWith('video/') })), [files])
  useEffect(() => () => previews.forEach(p => URL.revokeObjectURL(p.url)), [previews])

  useEffect(() => {
    if (!enablePaste) return
    function onPaste(e) {
      const pasted = Array.from(e.clipboardData?.items || [])
        .filter(item => item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter(Boolean)
      if (pasted.length) setFiles(prev => [...prev, ...pasted])
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [enablePaste])

  const addFiles = list => setFiles(prev => [...prev, ...Array.from(list || [])])
  const removeFile = index => setFiles(prev => prev.filter((_, i) => i !== index))

  // target = { matchRef, reportId, photoType, code } - geeft de id's van de
  // gelukte uploads terug (bv. om ze daarna meteen te publiceren).
  async function uploadAll(target) {
    const batch = files
    const uploaded = []
    const failed = new Set()
    const messages = []
    setErrors([])
    setProgress({ done: 0, total: batch.length })
    for (let i = 0; i < batch.length; i++) {
      try {
        const isVideo = batch[i].type.startsWith('video/')
        const body = isVideo ? batch[i] : await compressImage(batch[i])
        const photo = await uploadPhoto(body, target)
        uploaded.push(photo.id)
      } catch (e) {
        failed.add(batch[i])
        messages.push(`${batch[i].name || `Bestand ${i + 1}`}: ${e.message}`)
      }
      setProgress({ done: i + 1, total: batch.length })
    }
    setErrors(messages)
    // Mislukte bestanden blijven staan om opnieuw te proberen; tijdens het
    // uploaden geplakte bestanden ook.
    setFiles(prev => prev.filter(f => failed.has(f) || !batch.includes(f)))
    return uploaded
  }

  return { files, previews, addFiles, removeFile, uploadAll, progress, errors, busy: !!progress && progress.done < progress.total }
}
