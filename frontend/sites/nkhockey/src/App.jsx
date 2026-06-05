import React, { useState, useEffect, useMemo } from "react";
import {
  VERSION,
  COMP_LABELS,
  NK14_SLOTS,
  POULE_ORDER_14,
  POULE_ORDER_16,
  IS_O16,
  getSavedForm,
  saveForm,
  getSavedPlayed,
  savePlayed,
  getSavedMatches,
  saveMatches,
  getSavedSimCount,
  saveSimCount,
} from "./constants";
import { NK_SCHEDULES } from "./lib/nk-schedules";
import { getExpectedStandings } from "./components/SimTab/helpers";
import SimTab from "./components/SimTab";
import NavFilter from "./components/NavFilter";
import NavFilterDefault from "./components/NavFilterDefault";
import { useCompetitionData } from "./dataloader/useCompetitionData";
import DisclaimerPopup from "./components/popups/DisclaimerPopup";
import FeedbackPopup from "./components/popups/FeedbackPopup";
import HelpPopup from "./components/popups/HelpPopup";
import MenuPopup from "./components/popups/MenuPopup";
import SettingsPopup from "./components/popups/SettingsPopup";
import EasterEgg from "./components/common/EasterEgg";

const USE_NEW_NAV = true; // ← false voor oude navigatie

async function loadTheme() {
  try {
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
    const data = await fetch(`${baseUrl}/api/admin/themes/active`).then((r) =>
      r.json(),
    );
    const tokens = data.tokens || {};
    const root = document.documentElement;
    Object.entries(tokens).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  } catch {}
}

// Bereken welke NavFilter selectie past bij het focus team
function getFocusFilter(myTeam, data, effectiveComp) {
  if (!myTeam || !data) return { phases: new Set(), subs: new Set() };

  const o16 = IS_O16(effectiveComp);
  const pouleOrder = o16 ? POULE_ORDER_16 : POULE_ORDER_14;
  const phases = new Set();
  const subs = new Set();

  // Zoek eigen poule
  let myPouleId = null;
  for (const id of pouleOrder) {
    if (data[id]?.teams?.includes(myTeam)) {
      myPouleId = id;
      break;
    }
  }

  if (myPouleId) {
    phases.add("Poules");
    subs.add(myPouleId);
  }

  // Bereken expected standings
  const expected = getExpectedStandings(data, {}, pouleOrder);

  if (!o16) {
    // O14 — bepaal NK poule via NK14_SLOTS
    if (myPouleId && expected[myPouleId]) {
      const standing = expected[myPouleId];
      const rank = standing.findIndex((s) => s.team === myTeam);
      if (rank === 0 || rank === 1) {
        const slots = NK14_SLOTS[myPouleId];
        const slot = slots[rank]; // 'A' of 'B'
        phases.add("NK Fase");
        subs.add(`NK Poule ${slot}`);
      }
    }
  } else {
    // O16 — als team nr 1 of nr 2 is, zit het in de KF
    if (myPouleId && expected[myPouleId]) {
      const standing = expected[myPouleId];
      const rank = standing.findIndex((s) => s.team === myTeam);
      if (rank === 0 || rank === 1) {
        phases.add("NK Fase");
        subs.add("KF");
      }
    }
  }

  return { phases, subs };
}

export default function App() {
  const [showVersion, setShowVersion] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [helpMode, setHelpMode] = useState("tab");
  const [easterEgg, setEasterEgg] = useState(false);
  const easterClicks = React.useRef(0);
  const easterTimer = React.useRef(null);

  const [selectedPhases, setSelectedPhases] = useState(new Set());
  const [selectedSubs, setSelectedSubs] = useState(new Set());

  const [showDisclaimer, setShowDisclaimer] = useState(() => {
    try {
      return localStorage.getItem("nk_disclaimer_seen") !== "true";
    } catch {
      return true;
    }
  });
  const [showForm, setShowForm] = useState(getSavedForm);
  const [showPlayed, setShowPlayed] = useState(getSavedPlayed);
  const [showMatches, setShowMatches] = useState(getSavedMatches);
  const [simCount, setSimCount] = useState(getSavedSimCount);

  useEffect(() => {
    loadTheme();
  }, []);

  const {
    comps,
    loading,
    focusClub,
    focusMode,
    effectiveComp,
    data,
    myTeam,
    allClubs,
    visibleTypes,
    o16,
    setFocusClub,
    setFocusMode,
    setActiveCompetition,
    fetchFromServer,
  } = useCompetitionData();

  // Focus mode filter — automatisch juiste poule en NK fase selecteren
  useEffect(() => {
    if (!focusMode || !myTeam || !data || !effectiveComp) {
      if (!focusMode) {
        setSelectedPhases(new Set());
        setSelectedSubs(new Set());
      }
      return;
    }
    const { phases, subs } = getFocusFilter(myTeam, data, effectiveComp);
    setSelectedPhases(phases);
    setSelectedSubs(subs);
  }, [focusMode, myTeam, data, effectiveComp]);

  function onHockeyClick() {
    if (focusClub) setFocusMode(!focusMode);
    easterClicks.current++;
    if (easterClicks.current >= 5) {
      easterClicks.current = 0;
      setEasterEgg(true);
      setTimeout(() => setEasterEgg(false), 3500);
    }
    clearTimeout(easterTimer.current);
    easterTimer.current = setTimeout(() => {
      easterClicks.current = 0;
    }, 1500);
  }

  function dismissDisclaimer() {
    setShowDisclaimer(false);
    try {
      localStorage.setItem("nk_disclaimer_seen", "true");
    } catch {}
  }

  function handleSetActiveCompetition(type) {
    setActiveCompetition(type);
    setSelectedPhases(new Set());
    setSelectedSubs(new Set());
  }

  if (loading) return <div className="loading">Laden...</div>;
  if (!comps)
    return (
      <div className="loading">
        <p>Geen data beschikbaar.</p>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Gebruik de Chrome extensie om data te laden, of controleer of de data
          bestanden beschikbaar zijn.
        </p>
      </div>
    );

  return (
    <>
      <div className="top-bar">
        <div className="top-row">
          <div className="top-team">
            <div
              className="top-team-icon"
              onClick={onHockeyClick}
              style={{
                cursor: "pointer",
                border: focusMode
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
                borderRadius: "50%",
                overflow: "hidden",
              }}
              title={focusMode ? "Toon alles" : "Toon alleen " + focusClub}
            >
              🏑
            </div>
            <div
              className="top-team-name"
              onClick={() => setShowSettings(true)}
              style={{ cursor: "pointer" }}
              title="Instellingen"
            >
              {focusClub || "Kies club"}
              {focusMode && (
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--accent)",
                    marginLeft: 4,
                  }}
                >
                  focus
                </span>
              )}
            </div>
          </div>
          <div className="top-end">
            <button
              className="reload-btn"
              onClick={() => setShowSettings(!showSettings)}
              title="Instellingen"
            >
              ⚙️
            </button>
            <button
              className="reload-btn"
              onClick={() => {
                setHelpMode("tab");
                setShowHelp(!showHelp);
              }}
              title="Uitleg"
            >
              ❓
            </button>
            <button
              className="reload-btn"
              onClick={() => setShowVersion(!showVersion)}
              title="Menu"
            >
              v{VERSION}
            </button>
          </div>
        </div>

        {USE_NEW_NAV ? (
          <NavFilter
            visibleTypes={visibleTypes}
            effectiveComp={effectiveComp}
            setActiveCompetition={handleSetActiveCompetition}
            selectedPhases={selectedPhases}
            setSelectedPhases={setSelectedPhases}
            selectedSubs={selectedSubs}
            setSelectedSubs={setSelectedSubs}
            data={data}
          />
        ) : (
          <NavFilterDefault
            visibleTypes={visibleTypes}
            effectiveComp={effectiveComp}
            setActiveCompetition={handleSetActiveCompetition}
          />
        )}
      </div>

      {showVersion && (
        <MenuPopup
          onClose={() => setShowVersion(false)}
          onReload={fetchFromServer}
          onShowDisclaimer={() => setShowDisclaimer(true)}
          onShowFeedback={() => setShowFeedback(true)}
          onShowHelp={() => {
            setHelpMode("all");
            setShowHelp(true);
          }}
        />
      )}
      {showDisclaimer && <DisclaimerPopup onClose={dismissDisclaimer} />}
      {showFeedback && <FeedbackPopup onClose={() => setShowFeedback(false)} />}
      {showHelp && (
        <HelpPopup
          tab={helpMode === "all" ? "all" : "sim"}
          onClose={() => setShowHelp(false)}
        />
      )}
      {showSettings && (
        <SettingsPopup
          onClose={() => setShowSettings(false)}
          showForm={showForm}
          setShowForm={setShowForm}
          saveForm={saveForm}
          showPlayed={showPlayed}
          setShowPlayed={setShowPlayed}
          savePlayed={savePlayed}
          showMatches={showMatches}
          setShowMatches={setShowMatches}
          saveMatches={saveMatches}
          simCount={simCount}
          setSimCount={setSimCount}
          saveSimCount={saveSimCount}
          focusMode={focusMode}
          setFocusMode={setFocusMode}
          focusClub={focusClub}
          setFocusClub={setFocusClub}
          allClubs={allClubs}
        />
      )}

      <SimTab
        data={data}
        myTeam={myTeam}
        effectiveComp={effectiveComp}
        focusMode={focusMode}
        showForm={showForm}
        showPlayed={showPlayed}
        showMatches={showMatches}
        simCount={simCount}
        selectedPhases={selectedPhases}
        selectedSubs={selectedSubs}
        key={effectiveComp + "_sim"}
      />

      {easterEgg && <EasterEgg />}
    </>
  );
}
