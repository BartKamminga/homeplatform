import { useState, useEffect, useRef } from 'react'
import { t, useLanguage } from '../i18n.js'
import { AcConfirm } from '@components/arcade/overlays.jsx'
import ForecastView from './ForecastView.jsx'
import SetupView from './SetupView.jsx'
import LabView from './LabView.jsx'
import { up } from './tiers.js'

// Arcade-variant van FietsPrognose (item 1337): header + drie views, zelfde als classic FietsLayout.
export default function ArcadeApp() {
  const [view, setView] = useState('forecast')
  const [version, setVersion] = useState('')
  const [lang, setLang] = useLanguage()
  const [pending, setPending] = useState(null)
  const labGuard = useRef(null)

  useEffect(() => {
    fetch('/api/changelog?site=fiets').then(r => r.json()).then(d => { if (d[0]) setVersion(d[0].version) }).catch(() => {})
  }, [])

  function goTo(next) {
    const target = view === next ? 'forecast' : next
    if (view === 'lab' && labGuard.current?.dirty) { setPending(target); return }
    setView(target)
  }

  function leaveLab(save) {
    if (save) labGuard.current?.save()
    setView(pending)
    setPending(null)
  }

  const navBtn = (key, label) => (
    <button type="button" className={`ac-btn ac-btn--sm${view === key ? ' on' : ''}`} onClick={() => goTo(key)} aria-pressed={view === key}>{label}</button>
  )

  return (
    <div className="fa-app">
      <header className="fa-head">
        <button type="button" className="fa-brand" onClick={() => goTo('forecast')}>
          <span className="ac-logo">FIETSPROGNOSE</span>
          {version && <span className="fa-ver">V{version}</span>}
        </button>
        <nav className="fa-nav">
          {navBtn('lab', 'LAB')}
          {navBtn('setup', up(t(lang, 'nav.settings')))}
          <a className="ac-btn ac-btn--sm ac-btn--cyan" href="/account/groups?back=/fiets/" style={{ textDecoration: 'none' }}>{up(t(lang, 'nav.account'))}</a>
        </nav>
      </header>
      <main>
        {view === 'forecast' && <ForecastView lang={lang} />}
        {view === 'setup' && <SetupView lang={lang} onLangChange={setLang} />}
        {view === 'lab' && <LabView lang={lang} guardRef={labGuard} />}
      </main>
      {pending && (
        <AcConfirm title="UNSAVED WEIGHTS" message={t(lang, 'confirmLeave')} confirmLabel="SAVE"
          onConfirm={() => leaveLab(true)} onCancel={() => leaveLab(false)} />
      )}
    </div>
  )
}
