// frontend/sites/nkhockey/src/components/NavFilterDefault.jsx
// Originele navigatie — alleen competitie keuze
import { COMP_LABELS } from '../constants'

export default function NavFilterDefault({ visibleTypes, effectiveComp, setActiveCompetition }) {
  return (
    <div className="top-comp-row">
      {visibleTypes.map(t => (
        <button
          key={t}
          className={`top-comp-btn ${effectiveComp === t ? 'active' : ''}`}
          onClick={() => setActiveCompetition(t)}
        >
          {COMP_LABELS[t] || t}
        </button>
      ))}
    </div>
  )
}
