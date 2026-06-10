import { useState } from "react";
import {
  getSavedForm, saveForm,
  getSavedPlayed, savePlayed,
  getSavedMatches, saveMatches,
  getSavedSimCount, saveSimCount,
} from "../constants";

export function useNKAppState() {
  const [showVersion,   setShowVersion]   = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [showFeedback,  setShowFeedback]  = useState(false);
  const [showHelp,      setShowHelp]      = useState(false);
  const [helpMode,      setHelpMode]      = useState("tab");
  const [easterEgg,     setEasterEgg]     = useState(false);

  const [showDisclaimer, setShowDisclaimer] = useState(() => {
    try { return localStorage.getItem("nk_disclaimer_seen") !== "true"; }
    catch { return true; }
  });

  const [showForm,    setShowForm]    = useState(getSavedForm);
  const [showPlayed,  setShowPlayed]  = useState(getSavedPlayed);
  const [showMatches, setShowMatches] = useState(getSavedMatches);
  const [simCount,    setSimCount]    = useState(getSavedSimCount);

  function dismissDisclaimer() {
    setShowDisclaimer(false);
    try { localStorage.setItem("nk_disclaimer_seen", "true"); } catch {}
  }

  return {
    showVersion, setShowVersion,
    showSettings, setShowSettings,
    showFeedback, setShowFeedback,
    showHelp, setShowHelp,
    helpMode, setHelpMode,
    easterEgg, setEasterEgg,
    showDisclaimer, dismissDisclaimer,
    showForm, setShowForm, saveForm,
    showPlayed, setShowPlayed, savePlayed,
    showMatches, setShowMatches, saveMatches,
    simCount, setSimCount, saveSimCount,
  };
}
