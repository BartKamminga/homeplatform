// Gedeeld tussen de Kalender-dagview (DagView.jsx) en de scan-plan-preview
// (ScanPlanPreview.jsx, item 1084) - was tot item 1084 alleen in DagView.jsx
// gedefinieerd; 2 plekken met dezelfde reason-kleuren is het moment om te
// delen i.p.v. te dupliceren.
export const REASON_META = {
  match_start_check:     { label: 'Match-start-check',      color: '#2ab7ca' },
  match_end_check:       { label: 'Match-end-check',        color: '#eb6834' },
  retry_match_end:       { label: 'Retry match-end',        color: '#f2994a' },
  match_live:            { label: 'Match-live',             color: '#0ca30c' },
  daily_fallback:        { label: 'Dagelijkse fallback',    color: '#8a5cf6' },
  unknown_start_recheck: { label: 'Onbekende starttijd',    color: '#c026d3' },
  new_or_empty:          { label: 'Nieuwe/lege poule',      color: '#64748b' },
  manual_weekly:         { label: 'Wekelijkse ronde',       color: '#4f46e5' },
  club_scan:             { label: 'Club-scan',              color: '#0891b2' },
  club_list:             { label: 'Clublijst',              color: '#0e7490' },
}

export const COL_MATCH = '#2a78d6'
