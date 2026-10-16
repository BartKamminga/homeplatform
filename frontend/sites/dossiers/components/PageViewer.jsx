import { useEffect, useRef, useState } from 'react'
import { pageUrl } from '../api.js'

// Toont een HTML-uitwerking (kind page) schermvullend. sandbox zonder allow-same-origin:
// de pagina mag scripts draaien, maar kan niet bij het token of de rest van de site.
export default function PageViewer({ entry, onClose }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState('')
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    let current = null
    pageUrl(entry).then((u) => { current = u; setUrl(u) }).catch((e) => setError(e.message))
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); if (current) URL.revokeObjectURL(current) }
  }, [entry])

  return (
    <div className="ds-viewer" role="dialog" aria-modal="true" aria-label={entry.title}>
      <div className="ds-viewer-bar">
        <strong>{entry.title}</strong>
        <span className="ds-spacer" />
        {url && <a className="ds-btn ds-btn-small" href={url} target="_blank" rel="noopener noreferrer">Open in new tab</a>}
        <button type="button" className="ds-btn ds-btn-small" onClick={onClose}>Close</button>
      </div>
      {error ? <p className="ds-error">{error}</p>
        : url ? <iframe className="ds-viewer-frame" title={entry.title} src={url} sandbox="allow-scripts allow-popups" />
          : <p className="ds-muted">Loading page…</p>}
    </div>
  )
}
