import usePageMeta from './pageMeta.js'
import { PageIcon } from '../brand/navIcons.jsx'

// Kop van een vaste pagina met de (aanpasbare) titel en ondertitel (item 1248).
// suffix: bv. de poulenaam achter Competitie.
export default function PageTitle({ view, suffix = '' }) {
  const meta = usePageMeta()(view)
  return (
    <div style={{ margin: '0 0 12px' }}>
      <h2 style={{ fontSize: 17, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        {meta.icon && <PageIcon value={meta.icon} size={19} />}{meta.title}{suffix}
      </h2>
      {meta.subtitle && <p style={{ fontSize: 13, color: '#666', margin: '4px 0 0' }}>{meta.subtitle}</p>}
    </div>
  )
}
