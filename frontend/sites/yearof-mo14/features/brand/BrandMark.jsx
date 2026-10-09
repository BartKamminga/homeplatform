import useClubLogo from './useClubLogo.js'

// Woordmerk in de kop (Victoria-kleuren): clublogo in een geel rondje links,
// "MO14" als geel blok en "à Paris" schuin met Eiffeltorentje rechts.
export default function BrandMark({ onClick }) {
  const logo = useClubLogo()
  const clickable = !!onClick
  return (
    <div className="yof-brand" role={clickable ? 'link' : undefined} tabIndex={clickable ? 0 : undefined}
      onClick={onClick} onKeyDown={e => { if (clickable && e.key === 'Enter') onClick() }}
      style={{ cursor: clickable ? 'pointer' : 'default' }}>
      <span className="yof-brand-crest">
        {logo ? <img src={logo} alt="Victoria" /> : <span>🏑</span>}
      </span>
      <span className="yof-brand-title">
        <span className="yof-brand-mo14">MO14</span>
        <span className="yof-brand-paris">à Paris <span aria-hidden="true">🗼</span></span>
      </span>
    </div>
  )
}
