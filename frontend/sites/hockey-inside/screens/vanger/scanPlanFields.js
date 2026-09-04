// item 1084: uit VangerStatusCard.jsx getrokken (was daar samen met de
// ScanPlanTuning-JSX gedefinieerd) zodat zowel het instellingenformulier als
// de scan-plan-preview (die de instellingen nu zelf, in dezelfde kolom,
// tekent - zie ScanPlanPreview.jsx) dezelfde brondata gebruiken.
export const SCAN_PLAN_GROUPS = [
  {
    title: 'Wedstrijd-timing',
    fields: [
      { key: 'match_duration_min', label: 'Wedstrijdduur (min)',
        help: 'Aangenomen duur van een wedstrijd - bepaalt wanneer match_end_check begint (het voorspelde einde).' },
      { key: 'live_check_delay_min', label: 'Match-start-check na start (min)',
        help: 'Hoe lang na de voorspelde starttijd 1x gecheckt wordt of de wedstrijd live staat.' },
      { key: 'retry_match_end_min', label: 'Retry/live-cadans (min)',
        help: 'Hoe snel opnieuw gecheckt wordt na een nog-niet-finaal match_end_check-resultaat, of periodiek tijdens een bevestigd live wedstrijd (match_live). Elke retry is dynamisch - alleen de eerstvolgende staat gepland.' },
      { key: 'burst_stop_hours_after_last_match', label: 'Retry/live-stop (u na eigen einde)',
        help: 'Uiterste tijd per wedstrijd (ná haar EIGEN voorspelde einde) dat retry_match_end/match_live nog doorgaat als de uitslag maar niet verschijnt.' },
    ],
  },
  {
    title: 'Dagelijkse fallback',
    fields: [
      { key: 'active_daily_fallback_hours', label: 'Interval (u)',
        help: 'Hoe vaak een poule zonder wedstrijd vandaag alsnog ververst wordt - vangnet voor correcties.' },
    ],
  },
  {
    title: 'Onbekende starttijd',
    fields: [
      { key: 'unknown_start_lookahead_days', label: 'Vooruitkijken (dagen)',
        help: 'Tot hoeveel dagen vooruit een wedstrijd zonder bekende starttijd extra vaak gecheckt wordt.' },
      { key: 'unknown_start_fallback_hours', label: 'Hercheck-interval (u)',
        help: 'Hoe vaak zo\'n wedstrijd zonder starttijd binnen dat venster wordt herchecked.' },
    ],
  },
  {
    title: 'Club-discovery',
    fields: [
      { key: 'club_list_scan_days', label: 'Clublijst (dagen)',
        help: 'Hoe vaak de volledige clublijst van de bond wordt opgehaald.' },
      { key: 'club_scan_days', label: 'Club-scan (dagen)',
        help: 'Hoe vaak een individuele club opnieuw gescand wordt voor nieuwe poules. Nooit in het weekend.' },
    ],
  },
  {
    title: 'Systeem',
    fields: [
      { key: 'profile_scan_interval_min', label: 'Scan-plan interval (min)',
        help: 'Hoe vaak de scan-plan-pass als geheel draait - bepaalt ook hoe snel het scanschema ververst.' },
      { key: 'stale_cmd_timeout_min', label: 'Stuck-cmd-timeout (min)',
        help: 'Na hoeveel minuten een vastgelopen cmd (bezig zonder resultaat) als mislukt wordt teruggezet.' },
      { key: 'schedule_horizon_days', label: 'Scanschema-horizon (dagen)',
        help: 'Hoeveel dagen vooruit het scanschema plant (zichtbaar in de Kalender/Debug-tab).' },
      { key: 'scan_window_start_hour', label: 'Scan-venster start (uur)',
        help: 'Niet-wedstrijd-gebonden scans (fallback, wekelijks) worden niet vóór dit uur ingepland.' },
      { key: 'scan_window_end_hour', label: 'Scan-venster eind (uur)',
        help: 'Niet-wedstrijd-gebonden scans worden niet na dit uur ingepland - schuift door naar de volgende ochtend.' },
    ],
  },
]

// item 1084: welke groepen relevant zijn per scope - gebruikt om
// irrelevante instellingen te dimmen. "Onbekende starttijd" hoort bij
// Poule & Competitie (Bart, 4-09-2026: "'Onbekende starttijd' kan naar
// poule en competitie") - het scenario zelf is verhuisd naar dat scope in
// ScanPlanPreview.jsx.
export const SCOPE_GROUPS = {
  match: ['Wedstrijd-timing', 'Systeem'],
  poule: ['Dagelijkse fallback', 'Onbekende starttijd', 'Systeem'],
  club: ['Club-discovery'],
  season: [],
}

export const SCAN_PLAN_FIELDS = SCAN_PLAN_GROUPS.flatMap(g => g.fields)
export const SCAN_PLAN_KEYS = SCAN_PLAN_FIELDS.map(f => f.key)

// item 1001, Fase A: comma-gescheiden hockey.nl team_ids die een pushmelding
// krijgt zodra hun wedstrijd eindstand krijgt - los tekstveld, geen getal.
export const NOTIFY_KEY = 'notify_team_ids'
