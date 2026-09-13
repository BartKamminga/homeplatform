// Comprimeert een foto client-side vóór upload (mobiel, vaak grote camera-
// originelen) - resize naar maxDim + hercoderen als jpeg. Valt terug op het
// originele bestand als compressie om wat voor reden dan ook mislukt.
export async function compressImage(file, maxDim = 1920, quality = 0.82) {
  try {
    const bitmap = await createImageBitmap(file)
    let { width, height } = bitmap
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height)
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    return blob || file
  } catch {
    return file
  }
}
