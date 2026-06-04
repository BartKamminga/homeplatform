import React from "react";
import Popup from "../common/Popup";
import Toggle from "../common/Toggle";
import { applyTheme, getActiveTheme } from "@core/api.js";

const THEMES = [
  { key: "light", label: "☀️ Licht" },
  { key: "dark", label: "🌙 Donker" },
  { key: "victoria", label: "⚜️ Victoria" },
];

export default function SettingsPopup({
  onClose,
  showForm,
  setShowForm,
  saveForm,
  showPlayed,
  setShowPlayed,
  savePlayed,
  showMatches,
  setShowMatches,
  saveMatches,
  simCount,
  setSimCount,
  saveSimCount,
  focusMode,
  setFocusMode,
  focusClub,
  setFocusClub,
  allClubs,
}) {
  const [theme, setTheme] = React.useState(getActiveTheme);

  function handleTheme(key) {
    setTheme(key);
    applyTheme(key);
  }

  return (
    <Popup title="⚙️ Instellingen" onClose={onClose} maxWidth={400}>
      <div style={{ padding: "12px 16px" }}>
        {/* Thema */}
        <div
          style={{
            marginBottom: 12,
            paddingBottom: 12,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            Thema
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {THEMES.map((t) => (
              <button
                key={t.key}
                onClick={() => handleTheme(t.key)}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  fontSize: 12,
                  cursor: "pointer",
                  background:
                    theme === t.key ? "var(--accent)" : "var(--bg-card)",
                  color: theme === t.key ? "var(--btn-text)" : "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <Toggle
          checked={showForm}
          onChange={() => {
            const v = !showForm;
            setShowForm(v);
            saveForm(v);
          }}
          label="🔥 Vorm-badges"
          hint="laatste 5 wedstrijden"
        />
        <Toggle
          checked={showPlayed}
          onChange={() => {
            const v = !showPlayed;
            setShowPlayed(v);
            savePlayed(v);
          }}
          label="🎮 W-G-V"
          hint="winst-gelijk-verlies"
        />
        <Toggle
          checked={showMatches}
          onChange={() => {
            const v = !showMatches;
            setShowMatches(v);
            saveMatches(v);
          }}
          label="📋 Wedstrijden"
          hint="gespeelde uitslagen"
        />

        {/* Simulaties slider */}
        <div style={{ padding: "8px 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
            }}
          >
            <span>🎲 Simulaties</span>
            <input
              type="range"
              min="500"
              max="40000"
              step="500"
              value={simCount}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                setSimCount(v);
                saveSimCount(v);
              }}
              style={{ flex: 1 }}
            />
            <span
              style={{
                fontSize: 11,
                fontFamily: "'DM Mono',monospace",
                color: "var(--text-muted)",
                minWidth: 45,
                textAlign: "right",
              }}
            >
              {simCount.toLocaleString("nl-NL")}
            </span>
          </div>
        </div>

        {/* Focus mode + club */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            marginTop: 8,
            paddingTop: 12,
          }}
        >
          <Toggle
            checked={focusMode}
            onChange={() => setFocusMode(!focusMode)}
            label="🏑 Focus mode"
            hint="alleen poule van club"
          />
          <div style={{ marginTop: 4 }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginBottom: 6,
                fontWeight: 600,
              }}
            >
              Club
            </div>
            <div
              className="club-list"
              style={{
                maxHeight: 200,
                overflowY: "auto",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}
            >
              {allClubs.map((club) => (
                <div
                  key={club}
                  className={
                    "club-item" + (club === focusClub ? " club-active" : "")
                  }
                  onClick={() => setFocusClub(club)}
                >
                  {club === focusClub && (
                    <span style={{ color: "var(--accent)", marginRight: 6 }}>
                      ✓
                    </span>
                  )}
                  {club}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Popup>
  );
}
