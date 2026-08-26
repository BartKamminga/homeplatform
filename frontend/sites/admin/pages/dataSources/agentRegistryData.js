/* Ground truth: backend/services/agents/{fiets_agent,hockey_scan,poulebord_agent,roadmap_agent}.py
   Elke agent heeft een gesloten set data_sources (context) en post_processes (schrijfacties) —
   hard afgedwongen in routers/agent_control.py. "none" is bij elke agent de fallback (alleen melding). */

export const AGENT_REGISTRY = [
  {
    key: 'fiets_agent',
    label: 'Fiets-agent',
    routine: 'Geen routine-standaard — zonder een gekozen user_id doet deze agent niets (alleen heartbeat).',
    dataSources: [
      { key: 'debug_view', label: 'Debug-pagina data (ruwe bron + score-opbouw per uur)', note: 'Per user_id — zelfde data als GET /api/fiets/debug (KNMI/GFS/ICON, geblende waarden, score-opbouw).' },
    ],
    postProcesses: [
      { key: 'ai_score_graph', label: 'AI-score-grafiek opslaan', note: 'Schrijft een AI-score per uur naar UserPreference.extra.fiets_ai_score, naast de bestaande deterministische score.' },
    ],
  },
  {
    key: 'hockey_scan',
    label: 'Hockey scan-agent',
    routine: 'Routine-standaard: databron vanger_queue_state → post-process hockey_cmds.',
    dataSources: [
      { key: 'vanger_queue_state', label: 'Scan-queue status', note: 'Aantallen pending/in_progress/done/failed/skipped in vanger_cmd_queue.' },
      { key: 'club_scan_priority', label: 'Clubs met meeste wachtende teams', note: 'Top 20 clubs op aantal teams met no_new_poule_confirmed/season_pending.' },
      { key: 'vanger_health', label: 'Scout/Ghost-status + queue-gezondheid', note: 'Heartbeat-status, ghost_enabled/scan_plan_enabled.' },
      { key: 'plugin_errors', label: 'Recente vanger-plugin-fouten', note: 'Laatste foutmeldingen van Scout/Ghost.' },
    ],
    postProcesses: [
      { key: 'hockey_cmds', label: 'Cmd’s naar de scan-queue', note: 'Zet get_poule/scan_club/get_clubs/get_competition_detail/get_competitions in vanger_cmd_queue (na dedup).' },
      { key: 'roadmap_draft_item', label: 'Nieuw roadmap-item bij structureel probleem', note: 'Maakt een roadmap-item aan (status=idea), met dedup op exacte titel zodat een herhaald patroon niet elke run spawnt.' },
    ],
  },
  {
    key: 'poulebord_agent',
    label: 'Poulebord-agent',
    routine: 'Geen routine-standaard — zonder een gekozen link_id doet deze agent niets (alleen heartbeat).',
    dataSources: [
      { key: 'poule_standings', label: 'Poule-standen van een competitie', note: 'Per link_id (hockey_publication_comps.id) — competitienaam + standen per poule.' },
    ],
    postProcesses: [
      { key: 'poulebord_note', label: 'Notitie bij een competitie', note: 'Schrijft ai_note op hockey_publication_comps — zichtbaar op Poulebord via de bestaande publieke standings-respons.' },
    ],
  },
  {
    key: 'roadmap_agent',
    label: 'Roadmap-agent',
    routine: 'Routine-standaard: databron idea_items, geen post-process (geen roadmap_item_id om aan te schrijven zonder concrete opdracht).',
    dataSources: [
      { key: 'idea_items', label: 'Openstaande idea-items', note: 'Tot 10 roadmap-items met status=idea (titel, site, prioriteit, omschrijving).' },
    ],
    postProcesses: [
      { key: 'roadmap_preanalysis', label: 'Analyse-voorstel', note: 'Schrijft impact/risk/scope + "[AI-voorstel]"-geprefixte notes. Status blijft idea — een mens bevestigt het item.' },
    ],
  },
];
