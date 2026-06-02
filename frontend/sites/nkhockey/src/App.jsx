import React, { useState, useEffect } from 'react'
import { VERSION, COMP_LABELS, getSavedForm, saveForm, getSavedPlayed, savePlayed, getSavedMatches, saveMatches, getSavedSimCount, saveSimCount } from './constants'
import { NK_SCHEDULES } from './lib/nk-schedules'
import SimTab from './components/SimTab'
import { useCompetitionData } from './dataloader/useCompetitionData'
import DisclaimerPopup from './components/popups/DisclaimerPopup'
import FeedbackPopup from './components/popups/FeedbackPopup'
import HelpPopup from './components/popups/HelpPopup'
import MenuPopup from './components/popups/MenuPopup'
import SettingsPopup from './components/popups/SettingsPopup'
import EasterEgg from './components/common/EasterEgg'

// Load theme from homeplatform API
async function loadTheme() {
  try {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    const data = await fetch(`${baseUrl}/api/admin/themes/active`).then(r => r.json())
    const tokens = data.tokens || {}
    const root = document.documentElement
    Object.entries(tokens).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })
  } catch {
    // Use default CSS variables
  }
}

export default function App() {
  const [showVersion, setShowVersion] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [helpMode, setHelpMode] = useState('tab')
  const [easterEgg, setEasterEgg] = useState(false)
  const easterClicks = React.useRef(0)
  const easterTimer = React.useRef(null)
  const [showDisclaimer, setShowDisclaimer] = useState(() => {
    try { return localStorage.getItem('nk_disclaimer_seen') !== 'true' } catch { return true }
  })
  const [showForm, setShowForm] = useState(getSavedForm)
  const [showPlayed, setShowPlayed] = useState(getSavedPlayed)
  const [showMatches, setShowMatches] = useState(getSavedMatches)
  const [simCount, setSimCount] = useState(getSavedSimCount)

  // Load theme from homeplatform API on mount
  useEffect(() => {
    loadTheme()
  }, [])

  function onHockeyClick() {
    if (focusClub) setFocusMode(!focusMode)
    easterClicks.current++
    if (easterClicks.current >= 5) { easterClicks.current = 0; setEasterEgg(true); setTimeout(() => setEasterEgg(false), 3500) }
    clearTimeout(easterTimer.current)
    easterTimer.current = setTimeout(() => { easterClicks.current = 0 }, 1500)
  }

  function dismissDisclaimer() {
    setShowDisclaimer(false)
    try { localStorage.setItem('nk_disclaimer_seen', 'true') } catch {}
  }

  const {
    comps, loading, focusClub, focusMode, effectiveComp, data,
    myTeam, allClubs, visibleTypes, o16,
    setFocusClub, setFocusMode, setActiveCompetition, fetchFromServer
  } = useCompetitionData()

  if (loading) return <div className="loading">Laden...</div>
  if (!comps) return (
    <div className="loading">
      <p>Geen data beschikbaar.</p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Gebruik de Chrome extensie om data te laden, of controleer of de data bestanden beschikbaar zijn.</p>
    </div>
  )

  return (
    <>
      {/* Top bar */}
      <div className="top-bar">
        <div className="top-row">
          <div className="top-team">
            <div className="top-team-icon" onClick={onHockeyClick}
              style={{ cursor: 'pointer', border: focusMode ? '2px solid var(--accent)' : '2px solid transparent', borderRadius: '50%', overflow: 'hidden' }}
              title={focusMode ? 'Toon alles' : 'Toon alleen ' + focusClub}>
              🏑
            </div>
            <div className="top-team-name" onClick={() => setShowSettings(true)} style={{ cursor: 'pointer' }} title="Instellingen">
              {focusClub || 'Kies club'}{focusMode && <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 4 }}>focus</span>}
            </div>
          </div>
          <div className="top-end">
            <button className="reload-btn" onClick={() => setShowSettings(!showSettings)} title="Instellingen">⚙️</button>
            <button className="reload-btn" onClick={() => { setHelpMode('tab'); setShowHelp(!showHelp) }} title="Uitleg">❓</button>
            <button className="reload-btn" onClick={() => setShowVersion(!showVersion)} title="Menu">v{VERSION}</button>
          </div>
        </div>
        <div className="top-comp-row">
          {visibleTypes.map(t => <button key={t} className={`top-comp-btn ${effectiveComp === t ? 'active' : ''}`}
            onClick={() => setActiveCompetition(t)}>{COMP_LABELS[t] || t}</button>)}
        </div>
      </div>

      {/* Popups */}
      {showVersion && <MenuPopup onClose={() => setShowVersion(false)} onReload={fetchFromServer}
        onShowDisclaimer={() => setShowDisclaimer(true)} onShowFeedback={() => setShowFeedback(true)} onShowHelp={() => { setHelpMode('all'); setShowHelp(true) }} />}
      {showDisclaimer && <DisclaimerPopup onClose={dismissDisclaimer} />}
      {showFeedback && <FeedbackPopup onClose={() => setShowFeedback(false)} />}
      {showHelp && <HelpPopup tab={helpMode === 'all' ? 'all' : 'sim'} onClose={() => setShowHelp(false)} />}
      {showSettings && <SettingsPopup onClose={() => setShowSettings(false)}
        showForm={showForm} setShowForm={setShowForm} saveForm={saveForm}
        showPlayed={showPlayed} setShowPlayed={setShowPlayed} savePlayed={savePlayed}
        showMatches={showMatches} setShowMatches={setShowMatches} saveMatches={saveMatches}
        simCount={simCount} setSimCount={setSimCount} saveSimCount={saveSimCount}
        focusMode={focusMode} setFocusMode={setFocusMode}
        focusClub={focusClub} setFocusClub={setFocusClub} allClubs={allClubs} />}

      {/* Main content */}
      <SimTab data={data} myTeam={myTeam} effectiveComp={effectiveComp} focusMode={focusMode}
        showForm={showForm} showPlayed={showPlayed} showMatches={showMatches} simCount={simCount} key={effectiveComp + '_sim'} />

      {/* Easter egg */}
      {easterEgg && <EasterEgg />}
    </>
  )
}
