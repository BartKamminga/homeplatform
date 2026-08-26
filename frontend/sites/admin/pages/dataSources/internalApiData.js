/* verdict: 'yes' | 'partial' | 'no' — geschiktheid van de eigen /api/-call als context-input voor een agent.
   Gebaseerd op backend/routers/*.py — CRUD/mutatie-endpoints zijn sterk gegroepeerd, niet 1-op-1 opgesomd. */

export const INTERNAL_GROUPS = [
  {
    title: 'Auth & gebruikersbeheer',
    rows: [
      { source: 'GET /auth/me, /me/sites, /me/preferences', purpose: 'Profiel, sites en voorkeuren van de ingelogde gebruiker', file: 'routers/auth.py', verdict: 'yes', note: 'Compact rol/groep-overzicht.' },
      { source: 'POST /auth/login|refresh, POST /api-keys', purpose: 'Inloggen, token vernieuwen, API-key aanmaken', file: 'routers/auth.py', verdict: 'no', note: 'Geeft JWT’s / raw API-keys terug — nooit als context gebruiken.' },
      { source: 'GET/POST /auth/invite/{token}', purpose: 'Uitnodigingsflow', file: 'routers/auth.py', verdict: 'no', note: 'Token in het pad, gevoelig.' },
      { source: 'GET /admin/users|groups|sites|themes', purpose: 'Lijst gebruikers/groepen/sites/thema’s', file: 'routers/{users,groups,sites,themes}.py', verdict: 'yes', note: 'Goede inventaris-context; CRUD-mutaties op dezelfde routers zijn acties, geen context.' },
    ],
  },
  {
    title: 'Audit, changelog & tracking',
    rows: [
      { source: 'GET /admin/audit-log', purpose: 'Gepagineerde audit-log van beheeracties', file: 'routers/audit.py', verdict: 'yes', note: '"Wat is er recent gebeurd" — goede structured context.' },
      { source: 'GET /changelog, GET /admin/changelog', purpose: 'Publieke en admin changelog-items', file: 'routers/changelog.py', verdict: 'yes', note: 'Uitstekende samenvatting van recente wijzigingen.' },
      { source: 'POST /track', purpose: 'Schrijft een tracking-event', file: 'routers/tracking.py', verdict: 'no', note: 'Puur write, geen leesbare context.' },
    ],
  },
  {
    title: 'System / infra / monitoring',
    rows: [
      { source: 'GET /health, /version, /config, /sites', purpose: 'Publieke status/versie/site-info', file: 'routers/system.py', verdict: 'yes', note: 'Lichte, stabiele contextendpoints.' },
      { source: 'GET /admin/system/overview', purpose: 'Brede systeemsamenvatting (tabellen, counts, storage)', file: 'routers/system.py', verdict: 'yes', note: 'Beste "overview"-endpoint van het platform — ideale agent-context.' },
      { source: 'GET /admin/api-stats, /site-stats', purpose: 'API-gebruiksstatistieken per site/endpoint', file: 'routers/system.py', verdict: 'yes', note: 'Goede structured context.' },
      { source: 'GET /admin/site-events', purpose: 'Ruwe events per site', file: 'routers/system.py', verdict: 'partial', note: 'Bevat een token-kolom per event — eerst filteren.' },
      { source: 'GET /admin/infrastructure, /infra/services', purpose: 'CPU/schijf/service-overzicht', file: 'routers/infra.py', verdict: 'yes', note: 'Direct bruikbaar als context voor een ops-agent.' },
      { source: 'POST /infra/services/runner/restart, /cron/toggle', purpose: 'Herstart runner / cron aan-uit', file: 'routers/infra.py', verdict: 'no', note: 'Actie, geen context.' },
      { source: 'GET /admin/backup/daily', purpose: 'Lijst dagelijkse backups', file: 'routers/backup.py', verdict: 'partial', note: 'Lijst is prima, export/import zelf is bestandstransfer.' },
      { source: 'GET /backup/export/{app}', purpose: 'Download van een data-export', file: 'routers/backup.py', verdict: 'no', note: 'Streamt een bestand.' },
    ],
  },
  {
    title: 'Agent Control — al specifiek voor agents gebouwd',
    rows: [
      { source: 'GET /agent-control/agents/{key}/context|knowledge|log', purpose: 'Per-agent context/kennis/log opvragen', file: 'routers/agent_control.py', verdict: 'yes', note: 'Precies hiervoor ontworpen — kern van het agent-geheugen.' },
      { source: 'GET /agent-control/contexts, /notifications, /tasks(/pending)', purpose: 'Beschikbare contexten, meldingen en takenwachtrij', file: 'routers/agent_control.py', verdict: 'yes', note: 'Bedoeld als LLM-context-laag.' },
      { source: 'POST /agents/{key}/heartbeat|toggle|result', purpose: 'Status doorgeven / agent aan-uit / resultaat posten', file: 'routers/agent_control.py', verdict: 'no', note: 'Acties/writes, geen context.' },
    ],
  },
  {
    title: 'Roadmap & DontForget',
    rows: [
      { source: 'GET /roadmap, /roadmap/{id}/history', purpose: 'Lijst en historie van roadmap-items', file: 'routers/roadmap.py', verdict: 'yes', note: 'Planning/backlog-overzicht — direct bruikbaar (roadmap-agent gebruikt dit al).' },
      { source: 'GET /dontforget/tasks', purpose: 'Openstaande taken', file: 'routers/dontforget.py', verdict: 'yes', note: 'Persoonlijke takenlijst.' },
      { source: 'POST/PATCH/DELETE op roadmap-items en taken', purpose: 'CRUD-mutaties', file: 'routers/{roadmap,dontforget}.py', verdict: 'no', note: 'Acties, geen context.' },
    ],
  },
  {
    title: 'Hockey Inside / Vanger',
    rows: [
      { source: 'GET /hockey/public/* (clubs, publications, standings, matches)', purpose: 'Publieke, read-only hockeydata', file: 'routers/hockey_public.py', verdict: 'yes', note: 'Zeer geschikt — geen auth, al gestructureerd.' },
      { source: 'GET /hockey/public/tournaments/{tid}/query/*', purpose: 'Voorgeaggregeerde ranking/scorers/upcoming-matches', file: 'routers/hockey_query.py', verdict: 'yes', note: 'Compacte, betekenisvolle JSON — ideale agent-input.' },
      { source: 'GET /hockey/competitions, /stats/by-season, /poules', purpose: 'Competitie- en poule-overzicht', file: 'routers/hockey_capture.py', verdict: 'yes', note: 'Goede context.' },
      { source: 'GET /hockey/vanger/status|settings, queue-lijsten', purpose: 'Status van Scout/Ghost en scan-queues', file: 'routers/hockey_vanger.py', verdict: 'partial', note: 'Nuttig voor status-bewustzijn, maar operationeel van aard — dit is exact wat de hockey scan-agent al als databron gebruikt (ds_vanger_queue_state, ds_vanger_health).' },
      { source: 'POST /hockey/vanger/* (scan/ghost/scout-acties, cmd-queue)', purpose: 'Besturingscommando’s naar de Vanger-scraper', file: 'routers/hockey_vanger.py', verdict: 'no', note: 'Acties, geen context — wel relevant als beschikbaar post-process voor een aanstuurbare agent.' },
    ],
  },
  {
    title: 'Tournix / Poulebord',
    rows: [
      { source: 'GET /tournix/tournaments/{tid}/standings|snapshots|predictions', purpose: 'Samenvattende toernooidata', file: 'routers/tournix_matches.py', verdict: 'yes', note: 'Uitstekende context.' },
      { source: 'GET /tournix/import/coverage(-detail), /log', purpose: 'Dekkingsrapportage van hockey.nl-import', file: 'routers/tournix_import.py', verdict: 'yes', note: 'Rapportage-achtig, goede context.' },
      { source: 'GET /tournix/public/boards/{code}, /phases/{pid}/standings', purpose: 'Publiek scorebord (Poulebord)', file: 'routers/poulebord.py', verdict: 'yes', note: 'Publiek, read-only — exact wat de poulebord-agent gebruikt (ds_poule_standings).' },
      { source: 'Generatie-acties (generate-schedule, auto-assign, resolve-placeholders)', purpose: 'Schema/poule-indeling genereren', file: 'routers/tournix_phases.py', verdict: 'no', note: 'Zware mutatie-acties.' },
    ],
  },
  {
    title: 'Scrapster & Fiets',
    rows: [
      { source: 'GET /scrapster/standings|matches', purpose: 'Hergepubliceerde Masters-toernooidata', file: 'routers/scrapster.py', verdict: 'yes', note: 'Goede context.' },
      { source: 'GET /fiets/prognose', purpose: 'Fietsweer-prognose', file: 'routers/fiets.py', verdict: 'yes', note: 'Compacte context.' },
      { source: 'GET /fiets/debug', purpose: 'Ruwe brondata + score-opbouw per uur', file: 'routers/fiets.py', verdict: 'partial', note: 'Interne debugdata, maar dit is exact de databron van de fiets-agent (ds_debug_view) — mits per user_id opgevraagd.' },
    ],
  },
  {
    title: 'BeatCrades & MixMusic',
    rows: [
      { source: 'GET /beatcrades/tree, /jobs, /tool-versions', purpose: 'Download-boomstructuur, actieve jobs, toolversies', file: 'routers/downloader.py', verdict: 'yes', note: 'Goede overzicht-context.' },
      { source: 'GET /mixmusic/tracks|genres|stats', purpose: 'Muziekbibliotheek-overzicht', file: 'routers/mixmusic.py', verdict: 'yes', note: 'Structured context.' },
      { source: 'GET /mixmusic/stream/{filepath}', purpose: 'Audio-stream', file: 'routers/mixmusic.py', verdict: 'no', note: 'Binaire data.' },
      { source: 'CRUD op secties/racks/crades/genres/hearts', purpose: 'Beheer downloadstructuur en favorieten', file: 'routers/{downloader,mixmusic}.py', verdict: 'no', note: 'Mutaties, geen context.' },
    ],
  },
];
